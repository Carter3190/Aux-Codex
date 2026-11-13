import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";

const bookingId = "22222222-2222-4222-8222-222222222222";
const providerId = "33333333-3333-4333-8333-333333333333";
const photoPaths = [
  `${providerId}/${bookingId}/44444444-4444-4444-8444-444444444444.jpg`,
  `${providerId}/${bookingId}/55555555-5555-4555-8555-555555555555.png`,
];
const source = readFileSync(new URL("../src/lib/marketplace/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function completionAction({
  authenticate = async () => {},
  complete = async () => true,
  notify = async () => ({ status: "sent" }),
} = {}) {
  const events = [], completed = [], notifications = [], invalidations = [];
  const signedInClient = Object.freeze({ session: "provider-session" });
  const dependencies = {
    "next/cache": { revalidatePath: (...args) => { events.push("revalidate"); invalidations.push(args); } },
    zod: { z },
    "@/lib/email/notifications": {
      notifyBookingParticipants: () => { throw new Error("Completion must use its customer-specific notification"); },
      notifyBookingCompletion: async (input) => { events.push("notify"); notifications.push(input); return notify(input); },
    },
    "@/lib/legal/agreements": { CURRENT_TERMS_VERSION: "test-constant-unused-by-completion" },
    "@/lib/supabase/server": { createClient: () => { throw new Error("Completion must use its authorized provider client"); } },
    "./data": { requireMarketplaceActionRole: async (role) => {
      events.push(`authenticate:${role}`);
      await authenticate(role);
      return { supabase: signedInClient };
    } },
    "./completion-photos": { completeBookingWithPhotos: async (...args) => {
      events.push("complete"); completed.push(args); return complete(...args);
    } },
  };
  const actionModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, actionModule, actionModule.exports);
  return { action: actionModule.exports.completeBooking, events, completed, notifications, invalidations, signedInClient };
}

function completionForm(paths = [], id = bookingId) {
  const form = new FormData();
  form.set("bookingId", id);
  paths.forEach((path) => form.append("completionPhotoPaths", path));
  return form;
}

test("completion rejects an invalid booking before authorization, photos or notification", async () => {
  const harness = completionAction();
  const result = await harness.action({}, completionForm(photoPaths, "not-a-booking-id"));
  assert.equal(result.status, "error");
  assert.match(result.message, /Invalid booking request/);
  assert.deepEqual(harness.events, []);
});

test("provider authorization must succeed before photo paths reach completion", async () => {
  const harness = completionAction({ authenticate: async () => { throw new Error("Sign in to your provider account."); } });
  const result = await harness.action({}, completionForm(photoPaths));
  assert.equal(result.status, "error");
  assert.match(result.message, /provider account/);
  assert.deepEqual(harness.events, ["authenticate:provider"]);
  assert.equal(harness.completed.length, 0);
  assert.equal(harness.notifications.length, 0);
  assert.equal(harness.invalidations.length, 0);
});

test("a new completion forwards ordered form photo paths and notifies after the atomic transition", async () => {
  const harness = completionAction();
  const result = await harness.action({}, completionForm(photoPaths));
  assert.equal(result.status, "success");
  assert.equal(harness.completed.length, 1);
  assert.equal(harness.completed[0][0], harness.signedInClient);
  assert.equal(harness.completed[0][1], bookingId);
  assert.deepEqual(harness.completed[0][2], photoPaths);
  assert.deepEqual(harness.notifications, [{ bookingId }]);
  assert.deepEqual(harness.events, ["authenticate:provider", "complete", "notify", "revalidate", "revalidate"]);
  assert.deepEqual(harness.invalidations, [["/dashboard/provider", "layout"], ["/dashboard/customer", "layout"]]);
});

test("photos remain optional when completing an authorized visit", async () => {
  const harness = completionAction();
  const result = await harness.action({}, completionForm());
  assert.equal(result.status, "success");
  assert.deepEqual(harness.completed[0][2], []);
  assert.equal(harness.notifications.length, 1);
});

test("completed-booking retries refresh the views without sending another email", async () => {
  const harness = completionAction({ complete: async () => false });
  const result = await harness.action({}, completionForm(photoPaths));
  assert.equal(result.status, "success");
  assert.deepEqual(harness.events, ["authenticate:provider", "complete", "revalidate", "revalidate"]);
  assert.equal(harness.notifications.length, 0);
  assert.equal(harness.invalidations.length, 2);
});

test("a rejected completion or invalid photo set cannot announce completed work", async () => {
  const harness = completionAction({ complete: async () => { throw new Error("The completion photo upload could not be verified."); } });
  const result = await harness.action({}, completionForm(photoPaths));
  assert.equal(result.status, "error");
  assert.match(result.message, /photo upload could not be verified/);
  assert.deepEqual(harness.events, ["authenticate:provider", "complete"]);
  assert.equal(harness.notifications.length, 0);
  assert.equal(harness.invalidations.length, 0);
});

test("failed email delivery keeps the completed visit successful and tells the provider", async () => {
  const harness = completionAction({ notify: async () => ({ status: "failed" }) });
  const result = await harness.action({}, completionForm(photoPaths));
  assert.equal(result.status, "success");
  assert.match(result.message, /This visit is complete/);
  assert.match(result.message, /customer email could not be sent/);
  assert.match(result.message, /open their booking/);
  assert.equal(harness.completed.length, 1);
  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.invalidations.length, 2);
});

test("one real transition followed by repeated submissions sends only one completion email", async () => {
  let transitions = 0;
  const harness = completionAction({ complete: async () => ++transitions === 1 });
  const results = await Promise.all([
    harness.action({}, completionForm(photoPaths)),
    harness.action({}, completionForm(photoPaths)),
    harness.action({}, completionForm(photoPaths)),
  ]);
  assert.ok(results.every((result) => result.status === "success"));
  assert.equal(harness.completed.length, 3);
  assert.deepEqual(harness.notifications, [{ bookingId }]);
});
