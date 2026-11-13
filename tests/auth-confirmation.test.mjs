import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";
import { safeDashboardReturnPath } from "../src/lib/auth/return-path.ts";

const source = readFileSync(new URL("../src/lib/auth/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function loadAction({ configured = true, send = async () => ({ error: null }) } = {}) {
  const calls = [];
  const dependencies = {
    "next/cache": { revalidatePath: () => { throw new Error("Resending must not mutate sessions"); } },
    "next/navigation": { redirect: () => { throw new Error("Resending must not redirect"); } },
    zod: { z },
    "@/lib/supabase/config": { isSupabaseConfigured: () => configured },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { resend: async (input) => { calls.push(input); return send(input); } } }) },
    "@/lib/legal/agreements": {},
    "./return-path": { safeDashboardReturnPath },
  };
  const actionModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, actionModule, actionModule.exports);
  return { resend: actionModule.exports.resendConfirmation, calls };
}

function emailForm(email) { const form = new FormData(); form.set("email", email); return form; }

test("confirmation resend validates before contacting Supabase", async () => {
  const { resend, calls } = loadAction();
  const result = await resend({}, emailForm("invalid-address"));
  assert.deepEqual(result.fieldErrors.email, ["Enter a valid email address."]);
  assert.equal(calls.length, 0);
});

test("confirmation resend normalizes the same email and uses signup resend only", async () => {
  const { resend, calls } = loadAction();
  const form = emailForm("  PROVIDER@example.com  ");
  form.set("next", "https://untrusted.example");
  const result = await resend({}, form);
  assert.deepEqual(calls, [{ type: "signup", email: "provider@example.com" }]);
  assert.equal(result.retryAfterSeconds, 60);
  assert.match(result.message, /newest confirmation email/);
});

test("confirmation resend does not reveal account existence or delivery details", async () => {
  const cases = [
    () => ({ error: null }),
    () => ({ error: { status: 400, code: "user_not_found", message: "private account details" } }),
    () => ({ error: { status: 422, code: "email_exists", message: "already confirmed" } }),
    () => ({ error: { status: 429, code: "over_email_send_rate_limit", message: "private limits" } }),
    () => ({ error: { status: 500, message: "private SMTP details" } }),
    () => { throw new Error("private network details"); },
  ];
  let expected;
  for (const send of cases) {
    const { resend } = loadAction({ send });
    const result = await resend({}, emailForm("person@example.com"));
    expected ??= result;
    assert.deepEqual(result, expected);
    assert.doesNotMatch(result.message, /person@example|private|already confirmed$/);
  }
});

test("missing confirmation configuration cannot make an auth request", async () => {
  const { resend, calls } = loadAction({ configured: false });
  const result = await resend({}, emailForm("person@example.com"));
  assert.match(result.message, /temporarily unavailable/);
  assert.equal(calls.length, 0);
});
