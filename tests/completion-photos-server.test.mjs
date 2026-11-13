import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import * as photoValues from "../src/lib/marketplace/completion-photo-values.ts";

const providerId = "10000000-0000-4000-8000-000000000001";
const bookingId = "10000000-0000-4000-8000-000000000002";
const objectId = "10000000-0000-4000-8000-000000000003";
const path = `${providerId}/${bookingId}/${objectId}.png`;
const exactTimestamp = "2026-11-13T21:00:00.123456+00:00";
// The Storage API round-trips its timestamp through a JavaScript Date. Its
// millisecond value is not the PostgreSQL object's exact six-digit version.
const storageTimestamp = new Date(exactTimestamp).toISOString();
const png = new Uint8Array(24);
png.set([137, 80, 78, 71, 13, 10, 26, 10]);
png.set([73, 72, 68, 82], 12);
const source = readFileSync(new URL("../src/lib/marketplace/completion-photos.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function harness({ status = "accepted", snapshotError = null, snapshotChanges = {}, bytes = png,
  onDownload = () => {}, verificationError = null, completedNow = true } = {}) {
  const events = [], attestations = [], completions = [];
  let databaseTimestamp = exactTimestamp;
  let adminCreations = 0;
  const admin = {
    rpc: async (name, args) => {
      if (name === "get_booking_completion_photo_snapshot") {
        events.push("snapshot");
        assert.deepEqual(args, {
          requested_booking_id: bookingId, requested_provider_id: providerId,
          requested_storage_path: path, requested_object_id: objectId,
        });
        return { data: snapshotError ? null : {
          id: objectId, updated_at: databaseTimestamp, content_type: "image/png",
          byte_size: png.length, ...snapshotChanges,
        }, error: snapshotError };
      }
      assert.equal(name, "record_booking_completion_photo_verification");
      events.push("verify");
      attestations.push(args);
      const stale = args.requested_object_updated_at !== databaseTimestamp;
      return { data: null, error: verificationError ?? (stale ? {
        code: "P0001", message: "The completion photo upload could not be verified. Upload it again.",
      } : null) };
    },
  };
  const bookingQuery = {
    select: () => bookingQuery,
    eq: () => bookingQuery,
    maybeSingle: async () => ({ data: { provider_id: providerId, status }, error: null }),
  };
  const supabase = {
    auth: { getClaims: async () => {
      events.push("claims");
      return { data: { claims: { sub: providerId } }, error: null };
    } },
    from: (table) => { assert.equal(table, "booking_requests"); events.push("booking"); return bookingQuery; },
    storage: { from: (bucket) => {
      assert.equal(bucket, photoValues.COMPLETION_PHOTO_BUCKET);
      return {
        list: async (folder, options) => {
          events.push("list");
          assert.equal(folder, `${providerId}/${bookingId}`);
          assert.equal(options.search, `${objectId}.png`);
          return { data: [{ id: objectId, name: `${objectId}.png`, updated_at: storageTimestamp,
            metadata: { size: png.length, mimetype: "image/png" } }], error: null };
        },
        download: async (requestedPath) => {
          events.push("download"); assert.equal(requestedPath, path);
          onDownload({ replace: () => { databaseTimestamp = "2026-11-13T21:00:00.123999+00:00"; } });
          return { data: new Blob([bytes], { type: "image/png" }), error: null };
        },
      };
    } },
    rpc: async (name, args) => {
      assert.equal(name, "complete_booking_with_photos");
      events.push("complete"); completions.push(args);
      return { data: completedNow, error: null };
    },
  };
  const dependencies = {
    "server-only": {},
    "@/lib/supabase/server": { createClient: () => { throw new Error("Unexpected gallery access"); } },
    "@/lib/supabase/admin": { createAdminClient: () => { adminCreations += 1; return admin; } },
    "./completion-photo-values": photoValues,
  };
  const helperModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, helperModule, helperModule.exports);
  return { run: (paths = [path]) => helperModule.exports.completeBookingWithPhotos(supabase, bookingId, paths),
    events, attestations, completions, adminCreations: () => adminCreations };
}

test("an unchanged image verifies using the full database timestamp despite rounded Storage listing", async () => {
  assert.equal(storageTimestamp, "2026-11-13T21:00:00.123Z");
  const h = harness();
  assert.equal(await h.run(), true);
  assert.deepEqual(h.events, ["claims", "booking", "list", "snapshot", "download", "verify", "complete"]);
  assert.deepEqual(h.attestations, [{ requested_booking_id: bookingId, requested_provider_id: providerId,
    requested_storage_path: path, requested_object_id: objectId, requested_object_updated_at: exactTimestamp,
    verified_content_type: "image/png", verified_byte_size: png.length }]);
  assert.deepEqual(h.completions, [{ requested_booking_id: bookingId, requested_photo_paths: [path] }]);
});

test("a sub-millisecond image mutation during download cannot reuse the earlier snapshot", async () => {
  const h = harness({ onDownload: ({ replace }) => replace() });
  await assert.rejects(h.run(), /completion photo.*(changed|verified)/i);
  assert.equal(h.attestations[0].requested_object_updated_at, exactTimestamp);
  assert.equal(h.completions.length, 0);
});

test("a rejected server attestation stops before booking completion", async () => {
  const h = harness({ verificationError: { code: "42501", message: "permission denied" } });
  await assert.rejects(h.run(), /completion photo/i);
  assert.equal(h.attestations.length, 1);
  assert.equal(h.completions.length, 0);
});

test("a missing or inconsistent database snapshot stops before downloading or attesting", async () => {
  for (const options of [
    { snapshotError: { code: "P0001", message: "Object unavailable" } },
    { snapshotChanges: { id: bookingId } },
    { snapshotChanges: { byte_size: png.length + 1 } },
    { snapshotChanges: { content_type: "image/jpeg" } },
    { snapshotChanges: { updated_at: "" } },
  ]) {
    const h = harness(options);
    await assert.rejects(h.run(), /completion photo/i);
    assert.equal(h.events.includes("download"), false);
    assert.equal(h.attestations.length, 0);
    assert.equal(h.completions.length, 0);
  }
});

test("invalid downloaded image bytes are never attested or completed", async () => {
  const h = harness({ bytes: new Uint8Array(png.length) });
  await assert.rejects(h.run(), /valid JPG, PNG, or WebP/);
  assert.equal(h.attestations.length, 0);
  assert.equal(h.completions.length, 0);
});

test("another provider's photo path is rejected before database or storage access", async () => {
  const h = harness();
  await assert.rejects(h.run([path.replace(providerId, objectId)]), /belong to this booking/);
  assert.deepEqual(h.events, ["claims"]);
  assert.equal(h.adminCreations(), 0);
});

test("photos stay optional and completed-booking retries do not read or attest images again", async () => {
  const optional = harness();
  assert.equal(await optional.run([]), true);
  assert.deepEqual(optional.events, ["claims", "booking", "complete"]);
  assert.equal(optional.adminCreations(), 0);
  const retry = harness({ status: "completed", completedNow: false });
  assert.equal(await retry.run(), false);
  assert.deepEqual(retry.events, ["claims", "booking", "complete"]);
  assert.equal(retry.adminCreations(), 0);
});
