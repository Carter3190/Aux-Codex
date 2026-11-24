import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { safeDashboardReturnPath } from "../src/lib/auth/return-path.ts";
import { supportActionsFor } from "../src/lib/navigation/support-actions.ts";

class Redirect extends Error {
  constructor(path) { super("redirect"); this.path = path; }
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const styles = new Proxy({}, { get: (_, key) => String(key) });
function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    if (name === "react/jsx-runtime") return runtime;
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
function elements(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, predicate));
  return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)];
}
function authPage(kind, profile) {
  return load(`../src/app/(auth)/${kind}/page.tsx`, {
    "next/link": { default: "Link" },
    "next/navigation": { redirect: (path) => { throw new Redirect(path); } },
    "@/lib/auth/profile": {
      getOptionalCurrentProfile: async () => profile,
      getRoleDashboardPath: (role) => `/dashboard/${role}`,
    },
    "@/lib/auth/return-path": { safeDashboardReturnPath },
    "@/components/auth/login-form": { LoginForm: "LoginForm" },
    "@/components/auth/signup-form": { SignupForm: "SignupForm" },
    "@/components/auth/auth.module.css": { default: styles },
  }).default;
}

test("signed-in members bypass login forms while trusted booking destinations survive", async () => {
  const booking = "/dashboard/customer/bookings/22222222-2222-4222-8222-222222222222?tab=review";
  for (const role of ["customer", "provider", "admin"]) {
    const page = authPage("login", { role });
    for (const [next, expected] of [[undefined, `/dashboard/${role}`], [booking, booking], ["//outside.test", `/dashboard/${role}`]]) {
      await assert.rejects(page({ searchParams: Promise.resolve({ next }) }), (error) => error instanceof Redirect && error.path === expected);
    }
  }
});

test("provider-intent sign-in offers matching account creation without widening return URL rules", async () => {
  for (const [next, signupHref] of [["/dashboard/provider/application", "/signup?role=provider"], ["/dashboard/provider/application?from=support", "/signup?role=provider"], [undefined, "/signup"], ["https://outside.test/dashboard/provider/application", "/signup"]]) {
    const tree = await authPage("login", null)({ searchParams: Promise.resolve({ next }) });
    assert.equal(elements(tree, (el) => el.type === "Link")[0].props.href, signupHref);
    assert.equal(elements(tree, (el) => el.type === "LoginForm")[0].props.nextPath, safeDashboardReturnPath(next) ?? undefined);
  }
});

test("existing customer provider signup continues through the same account", async () => {
  for (const role of ["customer", "provider", "admin"]) {
    const page = authPage("signup", { role });
    for (const requested of [undefined, "customer", "provider"]) {
      const expected = role === "customer" && requested === "provider" ? "/offer-services" : `/dashboard/${role}`;
      await assert.rejects(page({ searchParams: Promise.resolve({ role: requested }) }), (error) => error instanceof Redirect && error.path === expected);
    }
  }
  const anonymous = await authPage("signup", null)({ searchParams: Promise.resolve({ role: "provider" }) });
  assert.equal(elements(anonymous, (el) => el.type === "SignupForm")[0].props.defaultRole, "provider");
});

test("signup sign-in link tracks the selected role without accepting consent or creating an account", () => {
  let hooks = [], hookIndex = 0, signupCalls = 0;
  const action = () => { signupCalls++; };
  const { SignupForm } = load("../src/components/auth/signup-form.tsx", {
    "next/link": { default: "Link" },
    react: {
      useActionState: () => [{}, action, false],
      useState: (initial) => {
        const index = hookIndex++;
        if (!(index in hooks)) hooks[index] = initial;
        return [hooks[index], (value) => { hooks[index] = value; }];
      },
    },
    "@/lib/auth/actions": { signUp: action },
    "@/lib/auth/types": { initialAuthState: {} },
    "./auth.module.css": { default: styles },
  });
  function render() { hookIndex = 0; return SignupForm({ defaultRole: "customer" }); }
  function signIn(tree) { return elements(tree, (el) => el.type === "Link" && el.props.children === "Sign in")[0]; }
  let tree = render();
  assert.equal(signIn(tree).props.href, "/login");
  hooks[1] = true;
  elements(tree, (el) => el.type === "input" && el.props.value === "provider")[0].props.onChange();
  tree = render();
  assert.equal(signIn(tree).props.href, "/login?next=%2Fdashboard%2Fprovider%2Fapplication");
  assert.equal(hooks[1], false);
  elements(tree, (el) => el.type === "input" && el.props.value === "customer")[0].props.onChange();
  assert.equal(signIn(render()).props.href, "/login");
  assert.equal(signupCalls, 0);
});

test("Support gives each account only destinations it can use", () => {
  const hrefs = (cards) => cards.flatMap((card) => card.actions.map((action) => action.href));
  const guest = supportActionsFor(null);
  assert.ok(hrefs(guest).includes("/dashboard/bookings"));
  assert.ok(hrefs(guest).includes("/login"));
  const customer = supportActionsFor({ role: "customer", canUseCustomer: true, canUseProvider: false });
  assert.deepEqual(hrefs(customer), ["/dashboard/customer/bookings", "/offer-services", "/dashboard/customer"]);
  const provider = supportActionsFor({ role: "provider", canUseCustomer: false, canUseProvider: true });
  assert.deepEqual(hrefs(provider), ["/dashboard/provider/bookings", "/dashboard/provider/onboarding", "/dashboard/provider/payments", "/dashboard/provider"]);
  const dual = supportActionsFor({ role: "provider", canUseCustomer: true, canUseProvider: true });
  assert.ok(hrefs(dual).includes("/dashboard/customer/bookings"));
  assert.ok(hrefs(dual).includes("/dashboard/provider/bookings"));
  assert.ok(!hrefs(dual).includes("/offer-services"));
  assert.equal(dual.length, 4);
  for (const account of [customer, provider, dual, supportActionsFor({ role: "admin", canUseCustomer: false, canUseProvider: false })]) {
    assert.ok(!hrefs(account).includes("/login"));
    assert.equal(new Set(hrefs(account)).size, hrefs(account).length, "No duplicate destinations within signed-in support actions");
  }
});

test("anonymous booking help dispatches to the member's own booking workspace after sign-in", async () => {
  for (const role of ["customer", "provider", "admin"]) {
    const Page = load("../src/app/dashboard/bookings/page.tsx", {
      "next/navigation": { redirect: (path) => { throw new Redirect(path); } },
      "@/lib/auth/profile": { getCurrentProfile: async () => ({ role }), getRoleDashboardPath: (value) => `/dashboard/${value}` },
    }).default;
    const expected = role === "admin" ? "/dashboard/admin" : `/dashboard/${role}/bookings`;
    await assert.rejects(Page(), (error) => error instanceof Redirect && error.path === expected);
  }
});
