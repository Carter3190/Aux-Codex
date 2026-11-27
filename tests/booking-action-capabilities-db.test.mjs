import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const capabilityMigration = "20261127010000_booking_action_capabilities.sql";
const customer = "60000000-0000-4000-8000-000000000001";
const provider = "60000000-0000-4000-8000-000000000002";
const otherProvider = "60000000-0000-4000-8000-000000000003";
const admin = "60000000-0000-4000-8000-000000000004";
const otherCustomer = "60000000-0000-4000-8000-000000000005";
async function as(db, id, action, role = "authenticated") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  await db.exec(`set role ${role}`);
  try { return await action(); } finally { await db.exec("reset role"); }
}
async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,metadata jsonb,updated_at timestamptz default now(),unique(bucket_id,name));
    create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,service_role;
    grant select on storage.objects to anon;
  `);
  for (const name of (await readdir(migrations)).filter((name) => name.endsWith(".sql") && name <= capabilityMigration).sort()) {
    try { await db.exec(await readFile(new URL(name, migrations), "utf8")); }
    catch (error) { throw new Error(`Migration ${name}: ${error.message}`, { cause: error }); }
  }
  for (const [id, role] of [[customer, "customer"], [otherCustomer, "customer"], [provider, "provider"], [otherProvider, "provider"], [admin, "customer"]]) {
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [id, `${id}@example.test`, { full_name: "Test member", requested_role: role }]);
  }
  await db.query("update profiles set role='admin' where id=$1", [admin]);
  const service = randomUUID();
  await db.query("insert into provider_services(id,provider_id,name,pricing_type,price_cents) values($1,$2,'Test service','fixed',12500)", [service, provider]);
  await approve(db, service);
  return { db, service };
}
async function approve(db, service, insuranceId) {
  await db.query("delete from provider_service_credential_reviews where service_id=$1", [service]);
  await db.query(`insert into provider_service_credential_reviews(service_id,license_required,insurance_required,insurance_credential_ids,reviewed_by,reviewed_at)
    values($1,false,$2,$3,$4,now())`, [service, Boolean(insuranceId), insuranceId ? [insuranceId] : [], admin]);
  await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
}
async function booking(db, service, { status = "pending", day = 3, time = "10:00", customerId = customer } = {}) {
  const id = randomUUID();
  await db.query(`insert into booking_requests(id,customer_id,provider_id,service_id,customer_name,provider_name,service_name,pricing_type,price_cents,agreed_price_cents,requested_date,requested_start_time,service_location,status)
    values($1,$2,$3,$4,'Customer','Provider','Test service','fixed',12500,12500,current_date+$5::integer,$6,'Test location',$7)`, [id, customerId, provider, service, day, time, status]);
  return id;
}
const actions = async (db, ids, who = provider, role) => (await as(db, who, () => db.query("select * from get_provider_booking_action_capabilities($1::uuid[])", [ids]), role)).rows;
const respond = (db, id, decision) => as(db, provider, () => db.query("select respond_to_booking($1,$2,'')", [id, decision]));

test("provider booking display capabilities match guarded mutations without widening access", async (t) => {
  const { db, service } = await database();
  try {
    const first = await booking(db, service);
    await t.test("only the authenticated provider sees its requested owned rows, with bounded input", async () => {
      assert.deepEqual(await actions(db, [first], otherProvider), []);
      await assert.rejects(actions(db, [first], customer), /Only provider accounts/);
      await assert.rejects(actions(db, [first], admin), /Only provider accounts/);
      await assert.rejects(actions(db, [first], null), /Only provider accounts/);
      await assert.rejects(actions(db, [first], null, "anon"), /permission denied/);
      await assert.rejects(actions(db, Array.from({ length: 501 }, () => first)), /no more than 500/);
      assert.deepEqual(await actions(db, []), []);
      assert.deepEqual(await actions(db, [randomUUID()]), []);
      const [row] = await actions(db, [first, first]);
      assert.deepEqual(row, { booking_id: first, can_accept: true, accept_unavailable_reason: null, can_set_price: false, price_unavailable_reason: "price_unavailable" });
      assert.deepEqual(Object.keys(row).sort(), ["accept_unavailable_reason", "booking_id", "can_accept", "can_set_price", "price_unavailable_reason"], "No credential documents or dates are returned");
    });
    await t.test("approved eligible requests can be accepted; an occupied slot is explained", async () => {
      await respond(db, first, "accepted");
      const second = await booking(db, service, { customerId: otherCustomer });
      const [capability] = await actions(db, [second]);
      assert.equal(capability.can_accept, false);
      assert.equal(capability.accept_unavailable_reason, "slot_unavailable");
      await assert.rejects(respond(db, second, "accepted"), /already accepted another booking/);
      await respond(db, second, "declined");
      assert.equal((await actions(db, [second]))[0].accept_unavailable_reason, "request_closed");
    });
    await t.test("lost approval blocks acceptance and pricing while decline and historical completion remain available", async () => {
      const request = await booking(db, service, { time: "11:00" });
      const historical = await booking(db, service, { status: "accepted", day: 0, time: "12:00" });
      for (const status of ["pending", "rejected", "suspended"]) {
        await db.query("update profiles set provider_status=$1 where id=$2", [status, provider]);
        const projected = await actions(db, [request, historical]);
        assert.equal(projected.find((row) => row.booking_id === request).accept_unavailable_reason, "approval_required");
        assert.equal(projected.find((row) => row.booking_id === historical).price_unavailable_reason, "approval_required");
        await assert.rejects(respond(db, request, "accepted"), /not currently available for booking/);
        await assert.rejects(as(db, provider, () => db.query("select set_booking_price($1,15000)", [historical])), /Only approved providers/);
      }
      await respond(db, request, "declined");
      await as(db, provider, () => db.query("select complete_booking($1)", [historical]));
      assert.equal((await db.query("select status from booking_requests where id=$1", [historical])).rows[0].status, "completed");
      await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
    });
    await t.test("credential eligibility is evaluated at the visit date, not merely today", async () => {
      const request = await booking(db, service, { time: "13:00", day: 3 });
      const credential = randomUUID();
      const path = `${provider}/${credential}.pdf`;
      await db.query("insert into storage.objects(bucket_id,name) values('provider-credentials',$1)", [path]);
      await db.query(`insert into provider_credentials(id,provider_id,credential_type,title,issuer,expires_on,document_path,review_status,reviewed_at,reviewed_by)
        values($1,$2,'insurance','Insurance','Test carrier',current_date+1,$3,'approved',now(),$4)`, [credential, provider, path, admin]);
      await approve(db, service, credential);
      const [projected] = await actions(db, [request]);
      assert.equal(projected.can_accept, false);
      assert.equal(projected.accept_unavailable_reason, "service_review_required");
      await assert.rejects(respond(db, request, "accepted"), /required credentials must be current on the requested date/);
      await approve(db, service);
      assert.equal((await actions(db, [request]))[0].can_accept, true);
      await respond(db, request, "accepted");
    });
    await t.test("a specific inactive service cannot be accepted even if another service keeps the provider approved", async () => {
      const request = await booking(db, service, { time: "13:30" });
      const otherService = randomUUID();
      await db.query("insert into provider_services(id,provider_id,name,pricing_type,price_cents) values($1,$2,'Another service','fixed',12500)", [otherService, provider]);
      await approve(db, otherService);
      await db.query("update provider_services set is_active=false where id=$1", [service]);
      await db.query("update profiles set provider_status='approved' where id=$1", [provider]);
      const [projection] = await actions(db, [request]);
      assert.equal(projection.can_accept, false);
      assert.equal(projection.accept_unavailable_reason, "service_review_required");
      await assert.rejects(respond(db, request, "accepted"), /not currently available for booking/);
      await respond(db, request, "declined");
      await db.query("update provider_services set is_active=true where id=$1", [service]);
      await approve(db, service);
    });
    await t.test("accepted price editing respects every payment lock and does not alter recorded money", async () => {
      const selected = await booking(db, service, { status: "completed", time: "14:00" });
      assert.equal((await actions(db, [selected]))[0].can_set_price, true);
      await as(db, provider, () => db.query("select set_booking_price($1,14000)", [selected]));
      const payment = randomUUID();
      await db.query(`insert into booking_payments(id,booking_id,customer_id,provider_id,stripe_account_id,amount_cents,platform_fee_cents,status)
        values($1,$2,$3,$4,'acct_Test',14000,700,'checkout_pending')`, [payment, selected, customer, provider]);
      for (const status of ["checkout_pending", "processing", "paid", "partially_refunded", "refunded"]) {
        await db.query("update booking_payments set status=$1 where id=$2", [status, payment]);
        const before = (await db.query("select * from booking_payments where id=$1", [payment])).rows;
        const [projection] = await actions(db, [selected]);
        assert.equal(projection.can_set_price, false);
        assert.equal(projection.price_unavailable_reason, "checkout_started");
        await assert.rejects(as(db, provider, () => db.query("select set_booking_price($1,15000)", [selected])), /cannot change after checkout/);
        assert.deepEqual((await db.query("select * from booking_payments where id=$1", [payment])).rows, before);
      }
      for (const status of ["failed", "expired"]) {
        await db.query("update booking_payments set status=$1 where id=$2", [status, payment]);
        assert.equal((await actions(db, [selected]))[0].can_set_price, true);
      }
    });
  } finally { await db.close(); }
});
