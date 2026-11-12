import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Run the actual published registry, review gates, and new policy migration in
// isolated PostgreSQL. This test never reaches Supabase or Stripe.
const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const migration = (name) => source(`supabase/migrations/${name}`);
const customer = "10000000-0000-4000-8000-000000000001";
const otherCustomer = "10000000-0000-4000-8000-000000000002";
const provider = "10000000-0000-4000-8000-000000000003";
const oldBooking = "20000000-0000-4000-8000-000000000001";
const newBooking = "20000000-0000-4000-8000-000000000002";
const providerName = "Dylan's Home Services";

async function as(db, id, action, role = null) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  if (role) await db.exec(`set role ${role}`);
  try { return await action(); } finally { if (role) await db.exec("reset role"); }
}
const currentVersions = (db) => db.query(`select distinct on (document_key) * from legal_document_versions
  where effective_at <= now() order by document_key, effective_at desc, created_at desc`);
const record = (db, keys, source, context) => db.query("select record_current_legal_acceptances($1,$2,$3)", [keys, source, context]);
const review = (db, document) => db.query("select complete_current_legal_document_review($1,$2,$3,'accepted')", [document.document_key, document.document_version, document.content_sha256]);

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create type public.user_role as enum ('customer','provider','admin');
    create type public.provider_status as enum ('not_applicable','pending','approved','rejected','suspended');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    create table profiles (id uuid primary key, email text, full_name text, role public.user_role, provider_status public.provider_status);
    create table booking_requests (id uuid primary key, customer_id uuid references profiles, provider_name text);
  `);
  await db.query(`insert into profiles (id,email,full_name,role) values
    ($1,'customer@example.test','Customer','customer'),
    ($2,'other@example.test','Other Customer','customer'),
    ($3,'provider@example.test','Provider Original Name','provider')`, [customer, otherCustomer, provider]);
  await db.query("insert into booking_requests (id,customer_id,provider_name) values ($1,$2,$3),($4,$2,$3)", [oldBooking, customer, providerName, newBooking]);
  for (const file of [
    "20261026000000_versioned_legal_acceptances.sql",
    "20261027000000_legal_document_review_completions.sql",
    "20261106020000_service_credential_policy_versions.sql",
  ]) await db.exec(await migration(file));
  return db;
}

test("post-service policy migration preserves evidence and binds new booking assent", async (t) => {
  const db = await database();
  try {
    const oldTerms = (await currentVersions(db)).rows.find((row) => row.document_key === "terms");
    await as(db, customer, () => record(db, ["terms"], "booking_request", oldBooking));
    await as(db, customer, () => review(db, oldTerms), "authenticated");
    await as(db, otherCustomer, () => record(db, ["terms"], "account_reacceptance", null));
    await as(db, otherCustomer, () => review(db, oldTerms), "authenticated");
    const oldVersions = (await db.query("select * from legal_document_versions order by document_key,document_version")).rows;
    const oldAcceptances = (await db.query("select * from legal_acceptances order by id")).rows;
    const oldReviews = (await db.query("select * from legal_document_review_completions order by id")).rows;
    const update = await migration("20261111010000_post_service_policy_versions.sql");
    await db.exec(update);

    await t.test("old versions, acceptances, and completed reviews are unchanged", async () => {
      for (const version of oldVersions) {
        const rows = (await db.query("select * from legal_document_versions where document_key=$1 and document_version=$2", [version.document_key, version.document_version])).rows;
        assert.deepEqual(rows, [version]);
      }
      assert.deepEqual((await db.query("select * from legal_acceptances order by id")).rows, oldAcceptances);
      assert.deepEqual((await db.query("select * from legal_document_review_completions order by id")).rows, oldReviews);
      const beforeRerun = (await db.query("select * from legal_document_versions order by document_key,document_version")).rows;
      await db.exec(update);
      assert.deepEqual((await db.query("select * from legal_document_versions order by document_key,document_version")).rows, beforeRerun);
    });

    await t.test("current registry versions and hashes match the new published pages", async () => {
      const versions = (await currentVersions(db)).rows;
      for (const [key, path] of [["terms", "terms"], ["provider_agreement", "provider-agreement"]]) {
        const document = versions.find((row) => row.document_key === key);
        assert.equal(document.document_version, "2026-11-11");
        const digest = createHash("sha256").update(await source(`src/app/${path}/page.tsx`)).digest("hex");
        assert.equal(document.content_sha256, digest);
        assert.equal(document.document_path, `/${path}`);
      }
      assert.equal(versions.find((row) => row.document_key === "privacy").document_version, "2026-10-26");
      assert.equal(versions.find((row) => row.document_key === "provider_standards").document_version, "2026-11-05");
    });

    await t.test("new booking affirmation names the immutable provider snapshot and exact current terms", async () => {
      await db.query("update profiles set full_name='Provider Changed Name' where id=$1", [provider]);
      await as(db, customer, () => record(db, ["terms"], "booking_request", newBooking));
      const acceptance = (await db.query("select * from legal_acceptances where acceptance_context_id=$1", [newBooking])).rows[0];
      assert.equal(acceptance.affirmation, `I understand that ${providerName}, not Auxilium, will perform and be responsible for the requested service. If the provider accepts, any resulting service agreement will be directly with that provider. I agree to Auxilium’s current Terms of Service.`);
      assert.equal(acceptance.document_version, "2026-11-11");
      assert.equal(acceptance.document_key, "terms");
      assert.equal(acceptance.user_id, customer);
      assert.equal(acceptance.user_email, "customer@example.test");
      assert.equal(acceptance.accepted_role, "customer");
      await as(db, customer, () => record(db, ["terms"], "booking_request", newBooking));
      assert.deepEqual((await db.query("select * from legal_acceptances where acceptance_context_id=$1", [newBooking])).rows, [acceptance]);
    });

    await t.test("a booking acceptance cannot use another customer or an invalid context", async () => {
      const count = (await db.query("select count(*)::integer as count from legal_acceptances")).rows[0].count;
      await assert.rejects(as(db, otherCustomer, () => record(db, ["terms"], "booking_request", newBooking)), /Booking not found for this customer/);
      await assert.rejects(as(db, null, () => record(db, ["terms"], "booking_request", newBooking)), /Sign in before accepting/);
      await assert.rejects(as(db, customer, () => record(db, ["terms"], "booking_request", null)), /must identify its booking/);
      await assert.rejects(as(db, customer, () => record(db, ["terms"], "account_reacceptance", newBooking)), /does not use a booking context/);
      await assert.rejects(as(db, customer, () => record(db, ["provider_agreement"], "account_reacceptance", null)), /invalid for this account/);
      await assert.rejects(as(db, customer, () => record(db, ["missing_document"], "account_reacceptance", null)), /invalid for this account/);
      assert.equal((await db.query("select count(*)::integer as count from legal_acceptances")).rows[0].count, count);
      await assert.rejects(as(db, customer, () => record(db, ["terms"], "booking_request", newBooking), "authenticated"), /permission denied for function record_current_legal_acceptances/);
    });

    await t.test("old review proof cannot satisfy new terms and wrong hashes cannot be accepted", async () => {
      const documents = (await currentVersions(db)).rows;
      const terms = documents.find((row) => row.document_key === "terms");
      const privacy = documents.find((row) => row.document_key === "privacy");
      await assert.rejects(as(db, otherCustomer, () => review(db, oldTerms), "authenticated"), /legal document changed/);
      await assert.rejects(as(db, otherCustomer, () => review(db, { ...terms, content_sha256: "0".repeat(64) }), "authenticated"), /legal document changed/);
      await assert.rejects(as(db, otherCustomer, () => db.query("select accept_current_account_legal_agreements()"), "authenticated"), /review and confirm every current legal document/i);
      await as(db, otherCustomer, () => review(db, privacy), "authenticated");
      await assert.rejects(as(db, otherCustomer, () => db.query("select accept_current_account_legal_agreements()"), "authenticated"), /review and confirm every current legal document/i);
      await as(db, otherCustomer, () => review(db, terms), "authenticated");
      await as(db, otherCustomer, () => db.query("select accept_current_account_legal_agreements()"), "authenticated");
      const account = (await db.query("select document_key,document_version from legal_acceptances where user_id=$1 and acceptance_source='account_reacceptance' and (document_version='2026-11-11' or document_key='privacy') order by document_key", [otherCustomer])).rows;
      assert.deepEqual(account, [{ document_key: "privacy", document_version: "2026-10-26" }, { document_key: "terms", document_version: "2026-11-11" }]);
      assert.deepEqual((await db.query("select * from legal_acceptances where id=$1", [oldAcceptances[0].id])).rows, [oldAcceptances[0]]);
      assert.deepEqual((await db.query("select * from legal_document_review_completions where id=$1", [oldReviews[0].id])).rows, [oldReviews[0]]);
    });

    await t.test("published evidence remains append-only after the migration", async () => {
      await assert.rejects(db.query("update legal_document_versions set title='Rewritten' where document_key='terms'"), /append-only/);
      await assert.rejects(db.query("delete from legal_acceptances where id=$1", [oldAcceptances[0].id]), /append-only/);
      await assert.rejects(db.query("delete from legal_document_review_completions where id=$1", [oldReviews[0].id]), /append-only/);
    });
  } finally { await db.close(); }
});
