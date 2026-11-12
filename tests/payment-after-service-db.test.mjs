import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// These tests execute the actual PostgreSQL migrations and security-definer RPCs
// in an isolated in-memory database. No Stripe requests or live records are used.
const root = new URL("../", import.meta.url);
const migration = (name) => readFile(new URL(`supabase/migrations/${name}`, root), "utf8");
const customer = "00000000-0000-4000-8000-000000000001";
const otherCustomer = "00000000-0000-4000-8000-000000000002";
const provider = "00000000-0000-4000-8000-000000000003";
const otherProvider = "00000000-0000-4000-8000-000000000004";
const account = "acct_ProviderTest";
const paymentAfterService = await migration("20261111000000_payment_after_service.sql");

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function private.is_admin() returns boolean language sql stable as $$select false$$;
    create function private.set_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at = now(); return new; end
    $$;
    grant usage on schema auth, private to authenticated;
    create table public.profiles (id uuid primary key, role text, provider_status text);
    create table public.booking_requests (
      id uuid primary key, customer_id uuid references profiles, provider_id uuid references profiles,
      status text default 'accepted', requested_date date default current_date,
      customer_name text default 'Customer', service_name text default 'Service'
    );
    create table public.booking_messages (
      id uuid primary key default gen_random_uuid(), booking_id uuid references booking_requests,
      sender_id uuid references profiles, body text, created_at timestamptz default now()
    );
  `);
  // Use the existing production implementations, rather than copies in the test.
  for (const name of [
    "20260901020000_stripe_connect_payments.sql",
    "20260910000000_booking_completion_reviews.sql",
    "20261002000000_direct_charge_payments.sql",
  ]) await db.exec(await migration(name));
  await db.query("insert into profiles (id, role, provider_status) values ($1, 'customer', null), ($2, 'customer', null), ($3, 'provider', 'approved'), ($4, 'provider', 'approved')", [customer, otherCustomer, provider, otherProvider]);
  await db.query("insert into provider_payment_accounts (provider_id, stripe_account_id, details_submitted, payouts_enabled, transfers_active) values ($1,$2,true,true,true)", [provider, account]);
  return db;
}

async function as(db, id, operation) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("set role authenticated");
  try { return await operation(); } finally { await db.exec("reset role"); }
}

async function addBooking(db, { status = "accepted", amount = 500, dayOffset = 0, completedDaysAgo = null } = {}) {
  const id = randomUUID();
  await db.query(`insert into booking_requests (id, customer_id, provider_id, status, requested_date, agreed_price_cents, completed_at)
    values ($1,$2,$3,$4,current_date + $5::integer,$6,case when $7::integer is null then null else now() - ($7::text || ' days')::interval end)`,
  [id, customer, provider, status, dayOffset, amount, completedDaysAgo]);
  return id;
}

async function addPayment(db, bookingId, status, expiry = null) {
  const id = randomUUID();
  await db.exec("alter table booking_payments disable trigger user");
  try { await db.query(`insert into booking_payments (id, booking_id, customer_id, provider_id, stripe_account_id, amount_cents, platform_fee_cents, status, checkout_expires_at, stripe_checkout_session_id)
    values ($1,$2,$3,$4,$5,500,25,$6,$7,$8)`, [id, bookingId, customer, provider, account, status, expiry, `cs_test_${id.replaceAll("-", "")}`]); }
  finally { await db.exec("alter table booking_payments enable trigger user"); }
  return id;
}

async function row(db, table, id) {
  return (await db.query(`select * from ${table} where id = $1`, [id])).rows[0];
}
const complete = (db, id, who = provider) => as(db, who, () => db.query("select complete_booking($1)", [id]));
const prepare = (db, id, who = customer) => as(db, who, () => db.query("select * from prepare_booking_payment($1)", [id]));
const price = (db, id, amount, who = provider) => as(db, who, () => db.query("select set_booking_price($1,$2)", [id, amount]));

// One PostgreSQL runtime keeps the suite fast; each scenario uses separate IDs.
test("payment-after-service migration and financial state transitions", async (t) => {
  const db = await database();
  let reconciledPaymentId;
  try {
    await t.test("rollout aborts without changing functions or payments when a Checkout can still be open", async () => {
      const bookingId = await addBooking(db);
      const paymentId = await addPayment(db, bookingId, "checkout_pending", new Date(Date.now() + 1800000).toISOString());
      for (const expiry of [new Date(Date.now() + 1800000).toISOString(), null, new Date(Date.now() - 1000).toISOString()]) {
        await db.query("update booking_payments set checkout_expires_at=$1 where id=$2", [expiry, paymentId]);
        await assert.rejects(db.exec(paymentAfterService), /reconcile all existing Checkout/);
        await db.exec("rollback");
        assert.equal((await row(db, "booking_payments", paymentId)).status, "checkout_pending");
        const oldFunction = (await db.query("select pg_get_functiondef('public.prepare_booking_payment(uuid)'::regprocedure) as definition")).rows[0].definition;
        assert.match(oldFunction, /Only accepted bookings can be paid/);
      }
      const saved = await row(db, "booking_payments", paymentId);
      await db.query("select record_stripe_checkout_event($1,'checkout.session.expired',$2,null,'unpaid',$3)", [
        `evt_${randomUUID().replaceAll("-", "")}`, saved.stripe_checkout_session_id, Math.floor(Date.now() / 1000),
      ]);
      reconciledPaymentId = paymentId;
    });

    await t.test("rollout preserves reconciled, settled and processing records exactly", async () => {
      const before = [];
      for (const status of ["paid", "partially_refunded", "refunded", "processing"]) {
        const id = await addPayment(db, await addBooking(db), status);
        before.push(await row(db, "booking_payments", id));
      }
      before.push(await row(db, "booking_payments", reconciledPaymentId));
      await db.exec(paymentAfterService);
      for (const saved of before) assert.deepEqual(await row(db, "booking_payments", saved.id), saved);
    });

    await t.test("a pre-deployment RPC body still cannot create an unfinished-work Checkout after rollout", async () => {
      const oldSource = await migration("20261002000000_direct_charge_payments.sql");
      await db.exec(oldSource.slice(oldSource.indexOf("create or replace function public.prepare_booking_payment(")));
      const id = await addBooking(db);
      await assert.rejects(prepare(db, id), /Only completed bookings can be paid/);
      assert.equal((await db.query("select count(*)::integer as count from booking_payments where booking_id=$1", [id])).rows[0].count, 0);
      await db.exec(paymentAfterService);
    });

    await t.test("accepted work cannot be paid; completing unpaid work creates no charge or payment row", async () => {
      const id = await addBooking(db);
      await assert.rejects(prepare(db, id), /Only completed bookings can be paid/);
      await complete(db, id);
      const done = await row(db, "booking_requests", id);
      assert.equal(done.status, "completed");
      assert.ok(done.completed_at);
      assert.equal((await db.query("select count(*)::integer as count from booking_payments where booking_id=$1", [id])).rows[0].count, 0);
      await complete(db, id);
      assert.deepEqual((await row(db, "booking_requests", id)).completed_at, done.completed_at);
      const prepared = (await prepare(db, id)).rows[0];
      assert.equal(prepared.amount_cents, 500);
      assert.equal(prepared.platform_fee_cents, 25);
      assert.equal(prepared.stripe_account_id, account);
      assert.equal((await row(db, "booking_payments", prepared.payment_id)).status, "checkout_pending");
      assert.deepEqual((await prepare(db, id)).rows[0], prepared);
    });

    await t.test("only the owning provider can complete accepted, arrived, priced work", async () => {
      const noPrice = await addBooking(db, { amount: null });
      await assert.rejects(complete(db, noPrice), /Set the agreed final price/);
      await assert.rejects(complete(db, await addBooking(db, { dayOffset: 1 })), /future booking/);
      for (const status of ["pending", "declined", "cancelled"]) {
        await assert.rejects(complete(db, await addBooking(db, { status })), /Only accepted bookings/);
      }
      const id = await addBooking(db);
      await assert.rejects(complete(db, id, customer), /Only provider accounts/);
      await assert.rejects(complete(db, id, otherProvider), /Booking request not found/);
      for (const status of ["checkout_pending", "processing"]) {
        const active = await addBooking(db);
        await addPayment(db, active, status);
        await assert.rejects(complete(db, active), /existing checkout payment/);
      }
      const refunded = await addBooking(db);
      await addPayment(db, refunded, "refunded");
      await assert.rejects(complete(db, refunded), /fully refunded booking/);
      const priorPaid = await addBooking(db);
      const priorPayment = await addPayment(db, priorPaid, "paid");
      await complete(db, priorPaid);
      assert.equal((await row(db, "booking_requests", priorPaid)).status, "completed");
      assert.equal((await row(db, "booking_payments", priorPayment)).status, "paid");
    });

    await t.test("checkout requires the owning customer, completed work, a price and a ready provider", async () => {
      const id = await addBooking(db, { status: "completed", completedDaysAgo: 0 });
      await assert.rejects(prepare(db, id, provider), /Only customer accounts/);
      await assert.rejects(prepare(db, id, otherCustomer), /Booking request not found/);
      await assert.rejects(as(db, customer, () => db.query("update booking_requests set status='completed' where id=$1", [id])), /permission denied/);
      await assert.rejects(as(db, customer, () => db.query("update booking_payments set status='paid' where booking_id=$1", [id])), /permission denied/);
      await assert.rejects(as(db, customer, () => db.query("select record_stripe_checkout_event('evt_forged','checkout.session.completed','cs_forged','pi_forged','paid',1)")), /permission denied/);
      await assert.rejects(prepare(db, await addBooking(db, { status: "completed", amount: null })), /final price/);
      for (const status of ["pending", "accepted", "cancelled", "declined"]) {
        await assert.rejects(prepare(db, await addBooking(db, { status })), /Only completed bookings/);
      }
      await db.query("update provider_payment_accounts set transfers_active=false where provider_id=$1", [provider]);
      await assert.rejects(prepare(db, id), /finish Stripe payout setup/);
      await db.query("update provider_payment_accounts set transfers_active=true where provider_id=$1", [provider]);
      for (const status of ["paid", "processing", "partially_refunded", "refunded"]) {
        const settled = await addBooking(db, { status: "completed" });
        await addPayment(db, settled, status);
        await assert.rejects(prepare(db, settled), /already has a payment/);
      }
    });

    await t.test("past local expiry never discards a Checkout awaiting its authoritative Stripe result", async () => {
      const id = await addBooking(db, { status: "completed" });
      const paymentId = await addPayment(db, id, "checkout_pending", new Date(Date.now() - 60000).toISOString());
      const before = await row(db, "booking_payments", paymentId);
      const prepared = (await prepare(db, id)).rows[0];
      assert.equal(prepared.checkout_attempt, 1);
      assert.equal(prepared.stripe_checkout_session_id, before.stripe_checkout_session_id);
      assert.deepEqual(await row(db, "booking_payments", paymentId), before);
      await assert.rejects(price(db, id, 600), /price cannot change after checkout/);
      await db.query("select record_stripe_checkout_event($1,'checkout.session.completed',$2,'pi_test_delayed','paid',$3)", [
        `evt_${randomUUID().replaceAll("-", "")}`, before.stripe_checkout_session_id, Math.floor(Date.now() / 1000),
      ]);
      const paid = await row(db, "booking_payments", paymentId);
      assert.equal(paid.status, "paid");
      assert.equal(paid.amount_cents, 500);
      assert.equal(paid.stripe_checkout_session_id, before.stripe_checkout_session_id);
      await assert.rejects(prepare(db, id), /already has a payment/);
    });

    await t.test("prices remain editable before Checkout on accepted and finished work, then lock", async () => {
      const id = await addBooking(db, { amount: null });
      await price(db, id, 10000);
      await price(db, id, 8000);
      await complete(db, id);
      await price(db, id, 9001);
      assert.equal((await row(db, "booking_requests", id)).agreed_price_cents, 9001);
      const prepared = (await prepare(db, id)).rows[0];
      assert.equal(prepared.amount_cents, 9001);
      assert.equal(prepared.platform_fee_cents, 450);
      await assert.rejects(price(db, id, 8500), /price cannot change after checkout/);
      await assert.rejects(price(db, id, 8500, otherProvider), /Booking request not found/);
      await assert.rejects(price(db, id, 99), /between \$1.00/);
      await assert.rejects(price(db, await addBooking(db, { status: "cancelled" }), 500), /only after accepting/);
    });

    await t.test("failed or expired attempts retry once with the current 5% fee and connected account", async () => {
      for (const status of ["failed", "expired"]) {
        const id = await addBooking(db, { status: "completed" });
        const paymentId = await addPayment(db, id, status);
        await price(db, id, 10010);
        const next = (await prepare(db, id)).rows[0];
        assert.equal(next.payment_id, paymentId);
        assert.equal(next.checkout_attempt, 2);
        assert.equal(next.amount_cents, 10010);
        assert.equal(next.platform_fee_cents, 501);
        assert.equal(next.stripe_account_id, account);
        assert.equal(next.stripe_checkout_session_id, null);
        assert.deepEqual((await prepare(db, id)).rows[0], next);
      }
    });

    await t.test("unpaid scheduled work cancels without a refund; finished work cannot be erased by cancellation", async () => {
      const id = await addBooking(db);
      await as(db, customer, () => db.query("select cancel_booking($1)", [id]));
      assert.equal((await row(db, "booking_requests", id)).status, "cancelled");
      assert.equal((await db.query("select count(*)::integer as count from booking_payments where booking_id=$1", [id])).rows[0].count, 0);
      const done = await addBooking(db, { status: "completed" });
      await assert.rejects(as(db, customer, () => db.query("select cancel_booking($1)", [done])), /cannot be cancelled/);
      assert.equal((await row(db, "booking_requests", done)).status, "completed");
    });

    await t.test("signed payment events remain idempotent and paid-only verified reviews remain protected", async () => {
      const id = await addBooking(db, { status: "completed", completedDaysAgo: 0 });
      await assert.rejects(as(db, customer, () => db.query("select create_booking_review($1,5,'Excellent completed work.')", [id])), /Only successfully paid/);
      const paymentId = await addPayment(db, id, "checkout_pending", new Date(Date.now() - 1000).toISOString());
      const saved = await row(db, "booking_payments", paymentId);
      const eventId = `evt_${randomUUID().replaceAll("-", "")}`;
      const args = [eventId, "checkout.session.completed", saved.stripe_checkout_session_id, "pi_test_completed", "paid", Math.floor(Date.now() / 1000)];
      assert.equal((await db.query("select record_stripe_checkout_event($1,$2,$3,$4,$5,$6) as recorded", args)).rows[0].recorded, true);
      assert.equal((await row(db, "booking_payments", paymentId)).status, "paid");
      assert.equal((await db.query("select record_stripe_checkout_event($1,$2,$3,$4,$5,$6) as recorded", args)).rows[0].recorded, false);
      await as(db, customer, () => db.query("select create_booking_review($1,5,'Excellent completed work.')", [id]));
      await assert.rejects(as(db, otherCustomer, () => db.query("select create_booking_review($1,5,'Excellent completed work.')", [id])), /Booking request not found/);
    });

    await t.test("completed unpaid conversations remain open, with the normal follow-up window for settled bookings", async () => {
      const unpaid = await addBooking(db, { status: "completed", completedDaysAgo: 40 });
      await as(db, customer, () => db.query("select send_booking_message($1,'Please confirm the payment details.')", [unpaid]));
      await assert.rejects(as(db, otherCustomer, () => db.query("select send_booking_message($1,'Unrelated customer.')", [unpaid])), /Conversation not found/);
      for (const status of ["paid", "partially_refunded", "refunded"]) {
        const settled = await addBooking(db, { status: "completed", completedDaysAgo: 40 });
        await addPayment(db, settled, status);
        await assert.rejects(as(db, customer, () => db.query("select send_booking_message($1,'Outside the follow-up window.')", [settled])), /conversation is closed/);
      }
    });
  } finally { await db.close(); }
});
