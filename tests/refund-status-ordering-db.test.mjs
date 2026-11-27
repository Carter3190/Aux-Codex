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
const orderingFile = "20261127020000_refund_status_ordering.sql";
async function applyCurrentMigrations(db) {
  for (const name of (await readdir(migrations)).filter((name) => name.endsWith(".sql") && name >= enrollmentFile && name <= orderingFile).sort()) await db.exec(await source(name));
}
async function refundFixture({ legacy = false } = {}) {
  const { db, service } = await database();
  if (!legacy) await applyCurrentMigrations(db);
  const booking = await addBooking(db, service, { status: "completed" });
  const payment = await addPaid(db, booking);
  await db.query("update booking_payments set stripe_payment_intent_id='pi_refund_test',stripe_charge_id='ch_refund_test' where id=$1", [payment]);
  const caseId = (await as(db, customer, () => db.query("select open_booking_case($1,'service_issue',12500,'Please review the agreed refund for this service issue.') id", [booking]))).rows[0].id;
  const prepared = (await as(db, admin, () => db.query("select * from prepare_booking_case_refund($1,5000,'Refund the agreed partial amount of fifty dollars.')", [caseId]))).rows[0];
  return { db, booking, payment, caseId, refund: prepared.refund_id };
}
function record(fixture, status, { event = null, at = null, previous = null, legacy = false, amount = 5000, currency = "usd", paymentIntent = "pi_refund_test", charge = "ch_refund_test", stripeId = "re_order_test", type = "refund.updated", failureReason = null } = {}) {
  const common = [fixture.refund, stripeId, paymentIntent, charge, amount, currency, status, failureReason, 1700000000, event, type];
  return as(fixture.db, null, () => legacy
    ? fixture.db.query("select record_booking_refund_state($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) recorded", common)
    : fixture.db.query("select record_booking_refund_event_state($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) recorded", [...common, at, previous]), "service_role");
}
async function snapshot(fixture) {
  return {
    refund: (await fixture.db.query("select * from booking_refunds where id=$1", [fixture.refund])).rows[0],
    payment: (await fixture.db.query("select * from booking_payments where id=$1", [fixture.payment])).rows[0],
    case: (await fixture.db.query("select * from booking_cases where id=$1", [fixture.caseId])).rows[0],
  };
}

test("late and same-second pending refund snapshots cannot undo a confirmed refund", async () => {
  const f = await refundFixture();
  try {
    assert.equal((await record(f, "succeeded", { event: "evt_confirmed", at: 1700000100, previous: "pending" })).rows[0].recorded, true);
    const confirmed = await snapshot(f);
    assert.equal(confirmed.payment.refunded_amount_cents, 5000);
    assert.equal(confirmed.case.status, "resolved_partially_refunded");
    for (const options of [
      { event: "evt_old_pending", at: 1700000099, previous: "requires_action" },
      { event: "evt_same_second_pending", at: 1700000100, previous: "requires_action" },
    ]) {
      assert.equal((await record(f, "pending", options)).rows[0].recorded, false);
      assert.deepEqual(await snapshot(f), confirmed);
      assert.equal((await record(f, "pending", options)).rows[0].recorded, false);
    }
    assert.equal((await record(f, "requires_action", { event: "evt_old_return", at: 1700000099, previous: "succeeded" })).rows[0].recorded, false);
    assert.equal((await record(f, "requires_action", { event: "evt_same_second_initial", at: 1700000100 })).rows[0].recorded, false);
    assert.equal((await record(f, "pending", { legacy: true, event: null })).rows[0].recorded, false);
    assert.deepEqual(await snapshot(f), confirmed);
    assert.equal((await f.db.query("select count(*)::integer n from stripe_webhook_events")).rows[0].n, 5);
  } finally { await f.db.close(); }
});

test("genuine signed bank-return corrections remain possible and repair payment/case state", async () => {
  const f = await refundFixture();
  try {
    await record(f, "succeeded", { event: "evt_initial_success", at: 1700000100, previous: "pending" });
    await record(f, "requires_action", { event: "evt_bank_return", at: 1700000110, previous: "succeeded" });
    let current = await snapshot(f);
    assert.equal(current.refund.status, "requires_action");
    assert.equal(current.payment.refunded_amount_cents, 0);
    assert.equal(current.payment.status, "paid");
    assert.equal(current.payment.refunded_at, null);
    assert.equal(current.case.status, "under_review");
    assert.equal(current.case.resolved_at, null);
    assert.equal(current.case.resolved_by, null);
    assert.equal((await f.db.query("select count(*)::integer n from booking_case_events where case_id=$1 and event_type='refund_requires_action'", [f.caseId])).rows[0].n, 1);
    await record(f, "pending", { event: "evt_corrected_details", at: 1700000111, previous: "requires_action" });
    await record(f, "succeeded", { event: "evt_reconfirmed", at: 1700000112, previous: "pending" });
    const reconfirmed = await snapshot(f);
    assert.equal(reconfirmed.payment.refunded_amount_cents, 5000);
    assert.equal(reconfirmed.case.status, "resolved_partially_refunded");
    assert.equal((await record(f, "requires_action", { event: "evt_late_old_bank_return", at: 1700000110, previous: "succeeded" })).rows[0].recorded, false);
    assert.deepEqual(await snapshot(f), reconfirmed);
    await record(f, "failed", { event: "evt_real_bank_failure", at: 1700000120, previous: "succeeded", type: "refund.failed", failureReason: "expired_or_canceled_card" });
    current = await snapshot(f);
    assert.equal(current.refund.status, "failed");
    assert.equal(current.payment.status, "paid");
    assert.equal(current.payment.refunded_amount_cents, 0);
    assert.equal(current.case.status, "under_review");
    assert.equal(current.refund.failure_reason, "expired_or_canceled_card");
    for (const transient of ["pending", "requires_action", "succeeded"]) {
      assert.equal((await record(f, transient, { legacy: true, event: null })).rows[0].recorded, false);
      assert.deepEqual(await snapshot(f), current);
      await assert.rejects(record(f, transient, { legacy: true, event: `evt_legacy_failed_${transient}` }), /verified event transition/);
      assert.equal((await f.db.query("select count(*)::integer n from stripe_webhook_events where event_id=$1", [`evt_legacy_failed_${transient}`])).rows[0].n, 0);
    }
    const retry = (await as(f.db, admin, () => f.db.query("select * from prepare_booking_case_refund($1,5000,'Review another refund only after the previous bank failure.')", [f.caseId]))).rows[0];
    const next = { ...f, refund: retry.refund_id };
    await record(next, "requires_action", { event: "evt_second_needs_details", at: 1700000130, stripeId: "re_second" });
    await record(next, "canceled", { event: "evt_second_canceled", at: 1700000131, previous: "requires_action", stripeId: "re_second", failureReason: "merchant_request" });
    assert.equal((await snapshot(next)).refund.status, "canceled");
    assert.equal((await snapshot(next)).payment.refunded_amount_cents, 0);
    const canceled = await snapshot(next);
    for (const transient of ["pending", "requires_action", "succeeded"]) {
      assert.equal((await record(next, transient, { legacy: true, event: null, stripeId: "re_second" })).rows[0].recorded, false);
      assert.deepEqual(await snapshot(next), canceled);
      await assert.rejects(record(next, transient, { legacy: true, event: `evt_legacy_canceled_${transient}`, stripeId: "re_second" }), /verified event transition/);
    }
    assert.equal((await f.db.query("select count(*)::integer n from booking_case_events where case_id=$1 and event_type='refund_canceled'", [f.caseId])).rows[0].n, 1);
  } finally { await f.db.close(); }
});

test("a verified pending return cycle repairs a resolved case and unproved terminal revival is ignored", async () => {
  const f = await refundFixture();
  try {
    await record(f, "succeeded", { event: "evt_confirmed_before_return_cycle", at: 1700000100 });
    await record(f, "pending", { event: "evt_missed_bank_details_return", at: 1700000120, previous: "requires_action" });
    const processing = await snapshot(f);
    assert.equal(processing.refund.status, "pending");
    assert.equal(processing.payment.status, "paid");
    assert.equal(processing.payment.refunded_amount_cents, 0);
    assert.equal(processing.case.status, "under_review");
    assert.equal((await f.db.query("select count(*)::integer n from booking_case_events where case_id=$1 and event_type='refund_pending'", [f.caseId])).rows[0].n, 1);
    await record(f, "failed", { event: "evt_terminal_bank_failure", at: 1700000130, previous: "pending", type: "refund.failed", failureReason: "declined" });
    const failed = await snapshot(f);
    assert.equal((await record(f, "succeeded", { event: "evt_stale_success_same_second", at: 1700000130, previous: "pending" })).rows[0].recorded, false);
    assert.equal((await record(f, "succeeded", { legacy: true, event: null })).rows[0].recorded, false);
    assert.deepEqual(await snapshot(f), failed);
  } finally { await f.db.close(); }
});

test("mismatched financial evidence rolls back without consuming a webhook fingerprint", async () => {
  const f = await refundFixture();
  try {
    const before = await snapshot(f);
    for (const [index, options] of [{ amount: 4900 }, { currency: "eur" }, { paymentIntent: "pi_different" }, { charge: "ch_different" }].entries()) {
      await assert.rejects(record(f, "succeeded", { event: `evt_mismatch_${index}`, at: 1700000100, ...options }), /does not match/);
      assert.deepEqual(await snapshot(f), before);
    }
    assert.equal((await f.db.query("select count(*)::integer n from stripe_webhook_events")).rows[0].n, 0);
    await record(f, "pending", { event: "evt_known_refund", at: 1700000100 });
    await assert.rejects(record(f, "succeeded", { event: "evt_wrong_refund", at: 1700000101, stripeId: "re_different" }), /does not match/);
    assert.equal((await f.db.query("select count(*)::integer n from stripe_webhook_events where event_id='evt_wrong_refund'")).rows[0].n, 0);
  } finally { await f.db.close(); }
});

test("legacy RPC and ledger records stay compatible without inventing timestamps or swallowing unproved corrections", async () => {
  const f = await refundFixture({ legacy: true });
  try {
    await record(f, "succeeded", { legacy: true, event: "evt_legacy_success" });
    const priorRefund = (await f.db.query("select * from booking_refunds where id=$1", [f.refund])).rows[0];
    const priorPayment = (await f.db.query("select * from booking_payments where id=$1", [f.payment])).rows[0];
    const priorCase = (await f.db.query("select * from booking_cases where id=$1", [f.caseId])).rows[0];
    await applyCurrentMigrations(f.db);
    const migrated = await snapshot(f);
    assert.equal(migrated.refund.stripe_last_event_created, null);
    const { stripe_last_event_created, ...unchangedRefund } = migrated.refund;
    assert.equal(stripe_last_event_created, null);
    assert.deepEqual(unchangedRefund, priorRefund);
    assert.deepEqual(migrated.payment, priorPayment);
    assert.deepEqual(migrated.case, priorCase);
    await assert.rejects(record(f, "requires_action", { legacy: true, event: "evt_old_handler_correction" }), /verified event transition/);
    assert.equal((await f.db.query("select count(*)::integer n from stripe_webhook_events where event_id='evt_old_handler_correction'")).rows[0].n, 0);
    assert.deepEqual(await snapshot(f), migrated);
    await record(f, "succeeded", { event: "evt_new_verified_current", at: 1700000100 });
    assert.equal((await record(f, "pending", { event: "evt_old_handler_correction", at: 1700000090 })).rows[0].recorded, false);
    const privilege = (await f.db.query(`select
      has_function_privilege('service_role','public.record_booking_refund_state(uuid,text,text,text,integer,text,text,text,bigint,text,text)','EXECUTE') old_service,
      has_function_privilege('service_role','public.record_booking_refund_event_state(uuid,text,text,text,integer,text,text,text,bigint,text,text,bigint,text)','EXECUTE') new_service,
      has_function_privilege('authenticated','public.record_booking_refund_event_state(uuid,text,text,text,integer,text,text,text,bigint,text,text,bigint,text)','EXECUTE') member_event,
      has_function_privilege('service_role','private.record_booking_refund_state(uuid,text,text,text,integer,text,text,text,bigint,text,text,bigint,text)','EXECUTE') direct_private,
      has_column_privilege('authenticated','public.booking_refunds','stripe_last_event_created','UPDATE') member_time`)).rows[0];
    assert.deepEqual(privilege, { old_service: true, new_service: true, member_event: false, direct_private: false, member_time: false });
    await assert.rejects(as(f.db, customer, () => f.db.query("select record_booking_refund_state(null,null,null,null,5000,'usd','pending',null,1700000000)")), /permission denied/);
    await assert.rejects(record(f, "pending", { event: "evt_missing_timestamp" }), /verified Stripe event identity and timestamp/);
  } finally { await f.db.close(); }
});

test("a bank failure does not violate the one-active-case rule or discard another open request", async () => {
  const f = await refundFixture();
  try {
    await record(f, "succeeded", { event: "evt_first_confirmed", at: 1700000100 });
    const otherCase = (await as(f.db, customer, () => f.db.query("select open_booking_case($1,'other',7500,'Please review a separate issue for the remaining balance.') id", [f.booking]))).rows[0].id;
    await record(f, "failed", { event: "evt_first_bank_failed", at: 1700000120, previous: "succeeded", type: "refund.failed", failureReason: "expired_or_canceled_card" });
    assert.equal((await snapshot(f)).case.status, "closed");
    assert.equal((await snapshot(f)).payment.refunded_amount_cents, 0);
    assert.equal((await f.db.query("select status from booking_cases where id=$1", [otherCase])).rows[0].status, "open");
  } finally { await f.db.close(); }
});
