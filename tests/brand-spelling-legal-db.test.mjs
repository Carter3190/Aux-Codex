import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const migration = (name) => source(`supabase/migrations/${name}`);
const customer = "10000000-0000-4000-8000-000000000001";
const provider = "10000000-0000-4000-8000-000000000002";
const oldBooking = "20000000-0000-4000-8000-000000000001";
const newBooking = "20000000-0000-4000-8000-000000000002";
const providerName = "Dylan's Home Services";
const brandingMigration = "20261117000000_auxillium_brand_spelling.sql";

async function as(db, id, action, role = null) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  if (role) await db.exec(`set role ${role}`);
  try { return await action(); } finally { if (role) await db.exec("reset role"); }
}

const currentVersions = (db) => db.query(`select distinct on (document_key) * from legal_document_versions
  where effective_at <= now() order by document_key, effective_at desc, created_at desc`);
const record = (db, keys, acceptanceSource, context) => db.query(
  "select record_current_legal_acceptances($1,$2,$3)", [keys, acceptanceSource, context]);
const review = (db, document) => db.query(
  "select complete_current_legal_document_review($1,$2,$3,'accepted')",
  [document.document_key, document.document_version, document.content_sha256]);

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
    create table provider_details (provider_id uuid primary key references profiles);
    create table provider_services (id uuid primary key default gen_random_uuid(), name text, description text);
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  `);
  await db.query(`insert into profiles (id,email,full_name,role) values
    ($1,'customer@example.test','Customer','customer'),
    ($2,'provider@example.test','Provider Original Name','provider')`, [customer, provider]);
  await db.query("insert into booking_requests (id,customer_id,provider_name) values ($1,$2,$3),($4,$2,$3)",
    [oldBooking, customer, providerName, newBooking]);
  for (const file of [
    "20261026000000_versioned_legal_acceptances.sql",
    "20261027000000_legal_document_review_completions.sql",
    "20261106020000_service_credential_policy_versions.sql",
    "20261111010000_post_service_policy_versions.sql",
  ]) await db.exec(await migration(file));
  return db;
}

test("brand spelling publication preserves historical evidence and gates the new exact documents", async (t) => {
  const db = await database();
  try {
    const priorDocuments = (await currentVersions(db)).rows;
    for (const document of priorDocuments) {
      await as(db, provider, () => review(db, document), "authenticated");
    }
    await as(db, provider, () => db.query("select accept_current_account_legal_agreements()"), "authenticated");
    await as(db, customer, () => record(db, ["terms"], "booking_request", oldBooking));
    const priorVersions = (await db.query("select * from legal_document_versions order by document_key, document_version")).rows;
    const priorAcceptances = (await db.query("select * from legal_acceptances order by id")).rows;
    const priorReviews = (await db.query("select * from legal_document_review_completions order by id")).rows;
    const priorProfiles = (await db.query("select * from profiles order by id")).rows;
    const priorBookings = (await db.query("select * from booking_requests order by id")).rows;
    const update = await migration(brandingMigration);
    await db.exec(update);

    await t.test("four new versions bind exact current source; all prior rows survive unchanged", async () => {
      const documents = (await currentVersions(db)).rows;
      assert.equal(documents.length, 4);
      for (const document of documents) {
        assert.equal(document.document_version, "2026-11-17");
        const page = await source(`src/app${document.document_path}/page.tsx`);
        assert.equal(document.content_sha256, createHash("sha256").update(page).digest("hex"));
        assert.doesNotMatch(page, /Auxilium/);
        const prior = priorDocuments.find((row) => row.document_key === document.document_key);
        const priorPage = page.replaceAll("Auxillium", "Auxilium");
        assert.equal(prior.content_sha256, createHash("sha256").update(priorPage).digest("hex"), "no legal wording other than brand spelling changed");
      }
      for (const old of priorVersions) {
        assert.deepEqual((await db.query("select * from legal_document_versions where document_key=$1 and document_version=$2",
          [old.document_key, old.document_version])).rows, [old]);
      }
      assert.deepEqual((await db.query("select * from legal_acceptances order by id")).rows, priorAcceptances);
      assert.deepEqual((await db.query("select * from legal_document_review_completions order by id")).rows, priorReviews);
      assert.deepEqual((await db.query("select * from profiles order by id")).rows, priorProfiles);
      assert.deepEqual((await db.query("select * from booking_requests order by id")).rows, priorBookings);
      const published = (await db.query("select * from legal_document_versions order by document_key, document_version")).rows;
      await db.exec(update);
      assert.deepEqual((await db.query("select * from legal_document_versions order by document_key, document_version")).rows, published);
    });

    await t.test("old review evidence cannot accept new versions; fresh reviews remain required", async () => {
      for (const document of priorDocuments) {
        await assert.rejects(as(db, provider, () => review(db, document), "authenticated"), /legal document changed/);
      }
      await assert.rejects(as(db, provider, () => db.query("select accept_current_account_legal_agreements()"), "authenticated"), /review and confirm every current legal document/i);
      const documents = (await currentVersions(db)).rows;
      const terms = documents.find((row) => row.document_key === "terms");
      await assert.rejects(as(db, provider, () => review(db, { ...terms, content_sha256: "0".repeat(64) }), "authenticated"), /legal document changed/);
      for (const document of documents) {
        await as(db, provider, () => review(db, document), "authenticated");
      }
      await as(db, provider, () => db.query("select accept_current_account_legal_agreements()"), "authenticated");
      const acceptances = (await db.query("select * from legal_acceptances where user_id=$1 and document_version='2026-11-17'", [provider])).rows;
      assert.equal(acceptances.length, 4);
      for (const acceptance of acceptances) {
        assert.equal(acceptance.affirmation, "I have reviewed each current Auxillium legal document and agree to or acknowledge it, as applicable.");
      }
    });

    await t.test("new booking assent corrects the brand while retaining immutable provider and ownership checks", async () => {
      await db.query("update profiles set full_name='Provider Changed Name' where id=$1", [provider]);
      await as(db, customer, () => record(db, ["terms"], "booking_request", newBooking));
      const rows = (await db.query("select * from legal_acceptances where acceptance_context_id=$1", [newBooking])).rows;
      assert.equal(rows.length, 1);
      const acceptance = rows[0];
      assert.equal(acceptance.affirmation, `I understand that ${providerName}, not Auxillium, will perform and be responsible for the requested service. If the provider accepts, any resulting service agreement will be directly with that provider. I agree to Auxillium’s current Terms of Service.`);
      assert.equal(acceptance.document_version, "2026-11-17");
      assert.equal(acceptance.user_id, customer);
      await as(db, customer, () => record(db, ["terms"], "booking_request", newBooking));
      assert.deepEqual((await db.query("select * from legal_acceptances where acceptance_context_id=$1", [newBooking])).rows, rows);
      await assert.rejects(as(db, provider, () => record(db, ["terms"], "booking_request", newBooking)), /Booking not found for this customer/);
      await assert.rejects(as(db, null, () => record(db, ["terms"], "booking_request", newBooking)), /Sign in before accepting/);
      await assert.rejects(as(db, customer, () => record(db, ["terms"], "booking_request", newBooking), "authenticated"), /permission denied for function record_current_legal_acceptances/);
      assert.deepEqual((await db.query("select * from legal_acceptances where acceptance_context_id=$1", [oldBooking])).rows,
        priorAcceptances.filter((row) => row.acceptance_context_id === oldBooking));
      await assert.rejects(db.query("update legal_document_versions set title='Rewritten' where document_key='terms'"), /append-only/);
      await assert.rejects(db.query("delete from legal_acceptances where id=$1", [priorAcceptances[0].id]), /append-only/);
      await assert.rejects(db.query("delete from legal_document_review_completions where id=$1", [priorReviews[0].id]), /append-only/);
    });

    await t.test("only future nameless accounts use the corrected fallback, with roles and supplied names preserved", async () => {
      await db.exec("create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user()");
      const fallback = "10000000-0000-4000-8000-000000000003";
      const supplied = "10000000-0000-4000-8000-000000000004";
      await db.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'fallback@example.test',$2::jsonb),($3,'supplied@example.test',$4::jsonb)",
        [fallback, JSON.stringify({ requested_role: "provider" }), supplied, JSON.stringify({ full_name: "Auxilium Family Services", requested_role: "admin" })]);
      assert.deepEqual((await db.query("select full_name,role,provider_status from profiles where id=$1", [fallback])).rows,
        [{ full_name: "Auxillium member", role: "provider", provider_status: "pending" }]);
      assert.deepEqual((await db.query("select full_name,role,provider_status from profiles where id=$1", [supplied])).rows,
        [{ full_name: "Auxilium Family Services", role: "customer", provider_status: "not_applicable" }]);
      assert.deepEqual((await db.query("select * from provider_details")).rows, [{ provider_id: fallback }]);
      for (const profile of priorProfiles.filter((row) => row.id !== provider)) {
        assert.deepEqual((await db.query("select * from profiles where id=$1", [profile.id])).rows, [profile]);
      }
    });

    await t.test("restricted-service check still blocks the same category with corrected customer-facing spelling", async () => {
      await db.exec("create trigger reject_restricted_provider_service before insert or update on provider_services for each row execute function private.reject_restricted_provider_service()");
      await db.query("insert into provider_services(name,description) values ('Furniture assembly','Assembly of customer-owned furniture')");
      await assert.rejects(db.query("insert into provider_services(name,description) values ('Medical care','Clinical patient-care work')"), /cannot be listed on Auxillium/);
      assert.equal((await db.query("select count(*)::integer as count from provider_services")).rows[0].count, 1);
    });
  } finally { await db.close(); }
});
