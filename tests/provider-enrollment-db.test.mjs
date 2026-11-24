import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Exercise production migrations, RLS and RPCs in local PostgreSQL. These tests
// never contact Supabase, Stripe, or real customers.
const migrations = new URL("../supabase/migrations/", import.meta.url);
const enrollmentFile = "20261123000000_existing_customer_provider_application.sql";
const customer = "50000000-0000-4000-8000-000000000001";
const stranger = "50000000-0000-4000-8000-000000000002";
const provider = "50000000-0000-4000-8000-000000000003";
const admin = "50000000-0000-4000-8000-000000000004";
const account = "acct_EnrollmentTest";
const source = (name) => readFile(new URL(name, migrations), "utf8");

async function as(db, id, action, role = "authenticated") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  await db.exec(`set role ${role}`);
  try { return await action(); } finally { await db.exec("reset role"); }
}
const currentDocuments = async (db) => (await db.query(`select distinct on (document_key) *
  from legal_document_versions where effective_at <= now()
  order by document_key,effective_at desc,created_at desc`)).rows;
async function acceptAccount(db, who) {
  const documents = await currentDocuments(db);
  const role = (await db.query("select role from profiles where id=$1", [who])).rows[0].role;
  for (const document of documents.filter((item) => item.audience === "all" || role === "provider")) {
    await as(db, who, () => db.query("select complete_current_legal_document_review($1,$2,$3,'accepted')",
      [document.document_key, document.document_version, document.content_sha256]));
  }
  await as(db, who, () => db.query("select accept_current_account_legal_agreements()"));
}
async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,metadata jsonb,updated_at timestamptz default now(),unique(bucket_id,name));
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]
    $$;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,service_role;
    grant select on storage.objects to anon;
  `);
  for (const name of (await readdir(migrations)).filter((name) => name.endsWith(".sql") && name < enrollmentFile).sort()) {
    try { await db.exec(await source(name)); }
    catch (error) { throw new Error(`Migration ${name}: ${error.message}`, { cause: error }); }
  }
  for (const [id, fullName, role] of [[customer, "Customer Original", "customer"], [stranger, "Other Customer", "customer"], [provider, "Provider Original", "provider"], [admin, "Administrator", "customer"]]) {
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [id, `${id}@example.test`, { full_name: fullName, requested_role: role }]);
  }
  await db.query("update profiles set role='admin' where id=$1", [admin]);
  const service = randomUUID();
  await db.query("insert into provider_services(id,provider_id,name,pricing_type,price_cents) values($1,$2,'A service','fixed',12500)", [service, provider]);
  await db.query(`insert into provider_availability(provider_id,weekday,is_available,start_time,end_time)
    select $1,day,true,'09:00','17:00' from generate_series(0,6) day`, [provider]);
  // Seed a legitimately approved service with explicit not-required decisions.
  await db.query(`insert into provider_service_credential_reviews(service_id,license_required,insurance_required,reviewed_by,reviewed_at)
    values($1,false,false,$2,now())`, [service, admin]);
  await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
  await db.query(`insert into provider_payment_accounts(provider_id,stripe_account_id,details_submitted,payouts_enabled,transfers_active)
    values($1,$2,true,true,true)`, [provider, account]);
  await acceptAccount(db, customer);
  return { db, service };
}
async function addBooking(db, service, { who = customer, status = "accepted", day = 1, time = "10:00" } = {}) {
  const id = randomUUID();
  await db.query(`insert into booking_requests(id,customer_id,provider_id,service_id,customer_name,provider_name,
    service_name,pricing_type,price_cents,agreed_price_cents,requested_date,requested_start_time,service_location,status)
    values($1,$2,$3,$4,'Customer Original','Provider Original','A service','fixed',12500,12500,current_date+$5::integer,$6,'A test location',$7)`,
  [id, who, provider, service, day, time, status]);
  return id;
}
async function addPaid(db, bookingId, who = customer) {
  const id = randomUUID();
  await db.query(`insert into booking_payments(id,booking_id,customer_id,provider_id,stripe_account_id,amount_cents,platform_fee_cents,status)
    values($1,$2,$3,$4,$5,12500,625,'paid')`, [id, bookingId, who, provider, account]);
  return id;
}
const rows = async (db, table) => (await db.query(`select * from ${table} order by id`)).rows;
const enroll = (db, who = customer, role) => as(db, who, () => db.query("select start_provider_application()"), role);
const request = async (db, service, { who = customer, providerId = provider, acknowledged = true, version, time = "13:00" } = {}) => {
  const terms = (await currentDocuments(db)).find((item) => item.document_key === "terms");
  return as(db, who, () => db.query("select request_booking($1,$2,current_date+2,$3,'A test location','',$4,$5) as id",
    [providerId, service, time, acknowledged, version ?? terms.document_version]));
};

test("existing-customer provider enrollment preserves identity and customer capabilities", async (t) => {
  const { db, service } = await database();
  try {
    const scheduled = await addBooking(db, service);
    const completed = await addBooking(db, service, { status: "completed", time: "11:00" });
    const paidId = await addPaid(db, completed);
    await as(db, customer, () => db.query("select send_booking_message($1,'An existing private conversation.')", [scheduled]));
    const preservedTables = ["booking_requests", "booking_payments", "booking_messages", "legal_acceptances", "legal_document_review_completions"];
    const snapshots = Object.fromEntries(await Promise.all(preservedTables.map(async (table) => [table, await rows(db, table)])));
    await db.exec(await source(enrollmentFile));

    await t.test("only the authenticated customer may enroll, with no target identity or role escalation input", async () => {
      await assert.rejects(enroll(db, null, "anon"), /permission denied for function start_provider_application/);
      await assert.rejects(enroll(db, null), /Sign in before starting/);
      await assert.rejects(enroll(db, randomUUID()), /account profile is unavailable/);
      await assert.rejects(enroll(db, admin), /Only customer accounts/);
      await assert.rejects(as(db, stranger, () => db.query("select start_provider_application($1)", [customer])), /does not exist/);
      await enroll(db);
      const profile = (await db.query("select * from profiles where id=$1", [customer])).rows[0];
      assert.equal(profile.role, "provider");
      assert.equal(profile.provider_status, "pending");
      assert.equal(profile.customer_access, true);
      assert.equal(profile.full_name, "Customer Original");
      assert.equal(profile.email, `${customer}@example.test`);
      assert.equal((await db.query("select role from profiles where id=$1", [stranger])).rows[0].role, "customer");
      assert.equal((await db.query("select count(*)::integer n from provider_details where provider_id=$1", [customer])).rows[0].n, 1);
      for (const table of preservedTables) assert.deepEqual(await rows(db, table), snapshots[table], `${table} must remain unchanged`);
    });

    await t.test("repeat enrollment is idempotent and cannot reset a rejection or suspension", async () => {
      const before = (await db.query("select * from profiles where id=$1", [customer])).rows[0];
      const details = (await db.query("select * from provider_details where provider_id=$1", [customer])).rows;
      await enroll(db);
      assert.deepEqual((await db.query("select * from profiles where id=$1", [customer])).rows[0], before);
      assert.deepEqual((await db.query("select * from provider_details where provider_id=$1", [customer])).rows, details);
      for (const status of ["rejected", "suspended"]) {
        await db.query("update profiles set provider_status=$1 where id=$2", [status, customer]);
        await enroll(db);
        assert.equal((await db.query("select provider_status from profiles where id=$1", [customer])).rows[0].provider_status, status);
      }
      await db.query("update profiles set provider_status='pending' where id=$1", [customer]);
      const originalProvider = (await db.query("select * from profiles where id=$1", [provider])).rows[0];
      await enroll(db, provider);
      assert.deepEqual((await db.query("select * from profiles where id=$1", [provider])).rows[0], originalProvider);
      assert.equal(originalProvider.customer_access, false);
      await assert.rejects(as(db, provider, () => db.query("select prepare_booking_payment($1)", [completed])), /Only customer accounts/);
    });

    await t.test("enrollment cannot grant approval, bypass application legal review, or edit protected profile columns", async () => {
      await assert.rejects(as(db, customer, () => db.query("update profiles set customer_access=false where id=$1", [customer])), /permission denied/);
      await assert.rejects(as(db, customer, () => db.query("update profiles set role='admin',provider_status='not_applicable' where id=$1", [customer])), /permission denied/);
      await assert.rejects(as(db, customer, () => db.query("update profiles set provider_status='approved' where id=$1", [customer])), /permission denied/);
      await assert.rejects(as(db, customer, () => db.query("select submit_provider_application(false,null,null)")), /Review and accept the current Provider Agreement/);
      await assert.rejects(as(db, customer, () => db.query("select submit_provider_application(true,'stale','stale')")), /provider agreements changed/);
      await assert.rejects(as(db, customer, () => db.query("select accept_current_account_legal_agreements()")), /Review and confirm every current legal document/);
      await assert.rejects(as(db, customer, () => db.query("select review_provider_application($1,'approved','')", [customer])), /Only administrators/);
      assert.equal((await db.query("select count(*)::integer n from legal_acceptances where user_id=$1 and document_key like 'provider_%'", [customer])).rows[0].n, 0);
    });

    await t.test("old customer records stay private and messages still use participant ownership", async () => {
      assert.equal((await as(db, customer, () => db.query("select * from booking_requests where id=$1", [scheduled]))).rows.length, 1);
      assert.equal((await as(db, customer, () => db.query("select * from booking_payments where id=$1", [paidId]))).rows.length, 1);
      assert.equal((await as(db, customer, () => db.query("select * from booking_messages where booking_id=$1", [scheduled]))).rows.length, 1);
      assert.equal((await as(db, stranger, () => db.query("select * from booking_requests where id=$1", [scheduled]))).rows.length, 0);
      assert.equal((await as(db, stranger, () => db.query("select * from booking_payments where id=$1", [paidId]))).rows.length, 0);
      assert.equal((await as(db, stranger, () => db.query("select * from booking_messages where booking_id=$1", [scheduled]))).rows.length, 0);
      await as(db, customer, () => db.query("select send_booking_message($1,'A follow-up after applying as a provider.')", [scheduled]));
      await assert.rejects(as(db, stranger, () => db.query("select send_booking_message($1,'An unauthorized message.')", [scheduled])), /Conversation not found/);
    });

    await t.test("retained customer booking, cancellation, post-service payment, review and support operations still work", async () => {
      const created = (await request(db, service)).rows[0].id;
      assert.equal((await db.query("select customer_id from booking_requests where id=$1", [created])).rows[0].customer_id, customer);
      await as(db, customer, () => db.query("select cancel_booking($1)", [created]));
      assert.equal((await db.query("select status from booking_requests where id=$1", [created])).rows[0].status, "cancelled");
      await assert.rejects(as(db, customer, () => db.query("select prepare_booking_payment($1)", [scheduled])), /Only completed bookings/);
      const unpaid = await addBooking(db, service, { status: "completed", time: "12:00" });
      const payment = (await as(db, customer, () => db.query("select * from prepare_booking_payment($1)", [unpaid]))).rows[0];
      assert.equal(payment.amount_cents, 12500);
      assert.equal(payment.platform_fee_cents, 625);
      assert.equal((await db.query("select customer_id from booking_payments where id=$1", [payment.payment_id])).rows[0].customer_id, customer);
      await as(db, customer, () => db.query("select create_booking_review($1,5,'Excellent completed work.')", [completed]));
      const opened = (await as(db, customer, () => db.query("select open_booking_case($1,'service_issue',100,'Please review this service issue for the completed visit.') as id", [completed]))).rows[0].id;
      assert.equal((await db.query("select customer_id from booking_cases where id=$1", [opened])).rows[0].customer_id, customer);
      assert.deepEqual((await db.query("select actor_id,actor_role from booking_case_events where case_id=$1", [opened])).rows,
        [{ actor_id: customer, actor_role: "customer" }]);
      for (const call of ["cancel_booking($1)", "prepare_booking_payment($1)", "create_booking_review($1,5,'Excellent completed work.')", "open_booking_case($1,'other',100,'Please review an unauthorized issue with the visit.')"]) {
        await assert.rejects(as(db, stranger, () => db.query(`select ${call}`, [completed])), /not found|cannot be cancelled/);
      }
    });

    await t.test("retained customer access preserves Terms and service credential eligibility gates", async () => {
      await assert.rejects(request(db, service, { acknowledged: false }), /Confirm that the provider/);
      await assert.rejects(request(db, service, { version: "stale" }), /Terms of Service changed/);
      await assert.rejects(request(db, service, { who: stranger }), /current account agreements/);
      await db.query("delete from provider_service_credential_reviews where service_id=$1", [service]);
      await assert.rejects(request(db, service), /required credentials must be current/);
      await assert.rejects(request(db, service, { providerId: customer }), /not currently available for booking/);
      assert.equal((await as(db, customer, () => db.query("select is_provider_booking_eligible($1) as eligible", [customer]))).rows[0].eligible, false);
    });

    await t.test("enrollment RPC privileges stay narrow and migration rerun preserves historical records", async () => {
      const access = (await db.query(`select
        has_function_privilege('anon','public.start_provider_application()','EXECUTE') as anon_execute,
        has_function_privilege('authenticated','public.start_provider_application()','EXECUTE') as member_execute,
        has_column_privilege('authenticated','public.profiles','customer_access','UPDATE') as change_access,
        has_column_privilege('authenticated','public.profiles','role','UPDATE') as change_role,
        has_function_privilege('anon','public.prepare_booking_payment(uuid)','EXECUTE') as anon_checkout`)).rows[0];
      assert.deepEqual(access, { anon_execute: false, member_execute: true, change_access: false, change_role: false, anon_checkout: false });
      const before = Object.fromEntries(await Promise.all(preservedTables.map(async (table) => [table, await rows(db, table)])));
      await db.exec(await source(enrollmentFile));
      for (const table of preservedTables) assert.deepEqual(await rows(db, table), before[table]);
    });
  } finally { await db.close(); }
});
