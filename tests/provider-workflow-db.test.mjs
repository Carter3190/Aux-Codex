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
const workflowFile = "20261127000000_provider_workflow_repairs.sql";
const applyRepairs = async (db) => { await db.exec(await source(enrollmentFile)); await db.exec(await source(workflowFile)); };
const profile = async (db) => (await db.query("select provider_status from profiles where id=$1", [provider])).rows[0];
const details = async (db) => (await db.query("select * from provider_details where provider_id=$1", [provider])).rows[0];
const attest = async (db, service, licenseIds = []) => db.query(`insert into provider_service_credential_reviews(service_id,license_required,insurance_required,license_credential_ids,reviewed_by,reviewed_at)
  values($1,$2,false,$3,$4,now()) on conflict(service_id) do update set license_required=excluded.license_required,license_credential_ids=excluded.license_credential_ids,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at`,
  [service, licenseIds.length > 0, licenseIds, admin]);

test("routine schedules, no-op saves and genuine review changes follow different approval rules", async (t) => {
  const { db, service } = await database();
  try {
    await applyRepairs(db);
    await db.query("update provider_details set submitted_at=now(),reviewed_at=now(),reviewed_by=$1 where provider_id=$2", [admin, provider]);
    const beforeDetails = await details(db);
    await t.test("changing hours or saving the same hours retains approved application and attestation", async () => {
      await as(db, provider, () => db.query("update provider_availability set start_time=start_time where provider_id=$1 and weekday=1", [provider]));
      await as(db, provider, () => db.query("update provider_availability set start_time='10:00' where provider_id=$1 and weekday=1", [provider]));
      assert.equal((await profile(db)).provider_status, "approved");
      assert.deepEqual(await details(db), beforeDetails);
      assert.equal((await db.query("select count(*)::integer n from provider_service_credential_reviews where service_id=$1", [service])).rows[0].n, 1);
    });
    await t.test("no-op introduction and service saves preserve approval, review evidence and snapshot timestamps", async () => {
      const serviceBefore = (await db.query("select * from provider_services where id=$1", [service])).rows[0];
      await as(db, provider, () => db.query("update provider_details set business_name=business_name,headline=headline,bio=bio,years_experience=years_experience,service_area=service_area,travel_radius_miles=travel_radius_miles where provider_id=$1", [provider]));
      await as(db, provider, () => db.query("update provider_services set name=name,description=description,pricing_type=pricing_type,price_cents=price_cents where id=$1", [service]));
      assert.deepEqual(await details(db), beforeDetails);
      assert.deepEqual((await db.query("select * from provider_services where id=$1", [service])).rows[0], serviceBefore);
      assert.equal((await profile(db)).provider_status, "approved");
    });
    await t.test("real introduction/scope and photo edits still require review and cannot bypass credential decisions", async () => {
      await as(db, provider, () => db.query("update provider_details set headline='A changed public introduction' where provider_id=$1", [provider]));
      assert.equal((await profile(db)).provider_status, "pending");
      assert.equal((await details(db)).submitted_at, null);
      await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
      await as(db, provider, () => db.query("update provider_details set service_area='A changed service area' where provider_id=$1", [provider]));
      assert.equal((await db.query("select count(*)::integer n from provider_service_credential_reviews where service_id=$1", [service])).rows[0].n, 0);
      await assert.rejects(db.query("update profiles set provider_status='approved' where id=$1", [provider]), /Review the required credentials/);
      await attest(db, service);
      await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
      const photoId = (await as(db, provider, () => db.query("insert into provider_photos(provider_id,storage_path,caption) values($1,$2,'Photo') returning id", [provider, `${provider}/work.jpg`]))).rows[0].id;
      assert.equal((await profile(db)).provider_status, "pending");
      await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
      await as(db, provider, () => db.query("update provider_photos set caption=caption where id=$1", [photoId]));
      assert.equal((await profile(db)).provider_status, "approved");
      await as(db, provider, () => db.query("update provider_photos set caption='Changed photo caption' where id=$1", [photoId]));
      assert.equal((await profile(db)).provider_status, "pending");
    });
    await t.test("routine saves and migration reruns never reinstate rejected or suspended providers", async () => {
      for (const status of ["rejected", "suspended"]) {
        await db.query("update profiles set provider_status=$1 where id=$2", [status, provider]);
        await as(db, provider, () => db.query("update provider_availability set start_time=start_time where provider_id=$1", [provider]));
        await db.exec(await source(workflowFile));
        assert.equal((await profile(db)).provider_status, status);
      }
    });
  } finally { await db.close(); }
});

test("archiving and editing services preserve booked history, ownership and future review requirements", async (t) => {
  const { db, service } = await database();
  try {
    await applyRepairs(db);
    const secondService = randomUUID();
    await db.query("insert into provider_services(id,provider_id,name,pricing_type,price_cents) values($1,$2,'Second service','fixed',15000)", [secondService, provider]);
    await attest(db, secondService);
    await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
    const completed = await addBooking(db, service, { status: "completed" });
    await addPaid(db, completed);
    const snapshots = { bookings: await rows(db, "booking_requests"), payments: await rows(db, "booking_payments") };
    await t.test("archive removes only the selected service from new requests and retains other approved services", async () => {
      await as(db, provider, () => db.query("update provider_services set is_active=false where id=$1", [service]));
      assert.equal((await profile(db)).provider_status, "approved");
      assert.equal((await db.query("select is_active from provider_services where id=$1", [service])).rows[0].is_active, false);
      assert.equal((await db.query("select private.service_credential_review_is_eligible($1,current_date) eligible", [service])).rows[0].eligible, false);
      assert.equal((await db.query("select private.service_credential_review_is_eligible($1,current_date) eligible", [secondService])).rows[0].eligible, true);
      await as(db, provider, () => db.query("update provider_services set name='Archived draft details',price_cents=16000 where id=$1", [service]));
      assert.equal((await profile(db)).provider_status, "approved");
      assert.equal((await db.query("select private.service_credential_review_is_eligible($1,current_date) eligible", [service])).rows[0].eligible, false);
      assert.deepEqual(await rows(db, "booking_requests"), snapshots.bookings);
      assert.deepEqual(await rows(db, "booking_payments"), snapshots.payments);
    });
    await t.test("restore and genuine edits require review without rewriting agreed historical prices", async () => {
      await as(db, provider, () => db.query("update provider_services set is_active=true where id=$1", [service]));
      assert.equal((await profile(db)).provider_status, "pending");
      await assert.rejects(db.query("update profiles set provider_status='approved' where id=$1", [provider]), /Review the required credentials/);
      await attest(db, service);
      await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
      await as(db, provider, () => db.query("update provider_services set name='Updated service',price_cents=17500 where id=$1", [service]));
      assert.equal((await profile(db)).provider_status, "pending");
      assert.deepEqual(await rows(db, "booking_requests"), snapshots.bookings);
      assert.deepEqual(await rows(db, "booking_payments"), snapshots.payments);
      await assert.rejects(as(db, provider, () => db.query("update provider_services set name='Medical service' where id=$1", [service])), /Restricted service/);
    });
    await t.test("another account cannot archive/edit the service or change owner/review columns", async () => {
      const current = (await db.query("select * from provider_services where id=$1", [service])).rows[0];
      const result = await as(db, stranger, () => db.query("update provider_services set is_active=false where id=$1 returning id", [service]));
      assert.equal(result.rows.length, 0);
      assert.deepEqual((await db.query("select * from provider_services where id=$1", [service])).rows[0], current);
      await assert.rejects(as(db, provider, () => db.query("update provider_services set provider_id=$1 where id=$2", [stranger, service])), /permission denied/);
      await assert.rejects(as(db, provider, () => db.query("update profiles set provider_status='approved' where id=$1", [provider])), /permission denied/);
      await assert.rejects(as(db, provider, () => db.query("delete from provider_services where id=$1", [service])), /RESTRICT|foreign key/);
    });
  } finally { await db.close(); }
});

test("private credential corrections require issuer and fresh evidence review without losing the document", async (t) => {
  const { db, service } = await database();
  try {
    const legacyId = randomUUID();
    await db.query("insert into provider_credentials(id,provider_id,credential_type,title,issuer,document_path) values($1,$2,'license','Legacy license','',$3)", [legacyId, provider, `${provider}/legacy.pdf`]);
    await applyRepairs(db);
    await t.test("existing incomplete metadata survives migration but license approval requires its issuer", async () => {
      assert.equal((await db.query("select issuer from provider_credentials where id=$1", [legacyId])).rows[0].issuer, "");
      await assert.rejects(as(db, admin, () => db.query("select review_provider_credential($1,'approved','')", [legacyId])), /issuing organization/);
      await assert.rejects(as(db, provider, () => db.query("insert into provider_credentials(provider_id,credential_type,title,issuer,document_path) values($1,'license','Another license','',$2)", [provider, `${provider}/empty.pdf`])), /issuing organization or carrier/);
      await assert.rejects(as(db, provider, () => db.query("update provider_credentials set issuer='' where id=$1", [legacyId])), /issuing organization or carrier/);
      await as(db, provider, () => db.query("update provider_credentials set issuer='State licensing board' where id=$1", [legacyId]));
      assert.equal((await db.query("select document_path from provider_credentials where id=$1", [legacyId])).rows[0].document_path, `${provider}/legacy.pdf`);
    });
    await db.query("insert into storage.objects(bucket_id,name) values('provider-credentials',$1)", [`${provider}/legacy.pdf`]);
    await as(db, admin, () => db.query("select review_provider_credential($1,'approved','')", [legacyId]));
    await attest(db, service, [legacyId]);
    await t.test("no-op metadata saves preserve approval and the current service attestation", async () => {
      const before = (await db.query("select * from provider_credentials where id=$1", [legacyId])).rows[0];
      await as(db, provider, () => db.query("update provider_credentials set title=title,issuer=issuer,credential_number=credential_number,expires_on=expires_on where id=$1", [legacyId]));
      assert.deepEqual((await db.query("select * from provider_credentials where id=$1", [legacyId])).rows[0], before);
      assert.equal((await db.query("select private.service_credential_review_is_eligible($1,current_date) eligible", [service])).rows[0].eligible, true);
    });
    await t.test("changed metadata resets individual approval and every selected service review, but keeps private file and account approval", async () => {
      const originalProfile = await profile(db);
      await as(db, provider, () => db.query("update provider_credentials set issuer='Corrected licensing board' where id=$1", [legacyId]));
      const changed = (await db.query("select * from provider_credentials where id=$1", [legacyId])).rows[0];
      assert.equal(changed.review_status, "pending");
      assert.equal(changed.reviewed_at, null);
      assert.equal(changed.reviewed_by, null);
      assert.equal(changed.document_path, `${provider}/legacy.pdf`);
      assert.deepEqual(await profile(db), originalProfile);
      assert.equal((await db.query("select private.service_credential_review_is_eligible($1,current_date) eligible", [service])).rows[0].eligible, false);
      await assert.rejects(as(db, provider, () => db.query("update provider_credentials set review_status='approved' where id=$1", [legacyId])), /permission denied/);
      assert.equal((await as(db, stranger, () => db.query("select * from provider_credentials where id=$1", [legacyId]))).rows.length, 0);
      assert.equal((await as(db, stranger, () => db.query("update provider_credentials set issuer='Other board' where id=$1 returning id", [legacyId]))).rows.length, 0);
    });
  } finally { await db.close(); }
});
