import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as drafts from "../src/components/provider/unsaved-form-state.ts";

test("draft fingerprints include submitted custom-field values and file metadata, excluding rotating action IDs", () => {
  const firstFile = new File(["example"], "work.jpg", { type: "image/jpeg", lastModified: 10 });
  const anotherFile = new File(["another"], "work.jpg", { type: "image/jpeg", lastModified: 11 });
  const fingerprint = (actionId, radius = "20", file = firstFile, visible = ["text:20"]) => drafts.fingerprintFormEntries([
    ["$ACTION_ID", actionId], ["radius", radius], ["pricingType", "quote"], ["expiresOn", "2027-01-01"], ["start", "09:00"], ["photo", file],
  ], visible);
  assert.equal(fingerprint("first"), fingerprint("rotated"));
  assert.notEqual(fingerprint("first"), fingerprint("first", "25"));
  assert.notEqual(fingerprint("first"), fingerprint("first", "20", anotherFile));
  assert.notEqual(fingerprint("first"), fingerprint("first", "20", firstFile, ["text:not a valid number"]));
  assert.equal(drafts.fingerprintFormEntries([["photo", new File([], "", { lastModified: 10 })]]),
    drafts.fingerprintFormEntries([["photo", new File([], "", { lastModified: 20 })]]), "Empty file fields must not become dirty over time");
});

test("restoring initial values is clean, and successful saving clears only that form's draft", () => {
  const tracker = drafts.createUnsavedFormTracker();
  tracker.register("intro", "original");
  tracker.register("service", "saved service");
  assert.equal(tracker.dirty("intro", "original"), false);
  assert.equal(tracker.dirty("intro", "edited"), true);
  assert.equal(tracker.dirty("intro", "original"), false);
  tracker.submitting("intro", "edited");
  assert.equal(tracker.dirty("intro", "edited"), true, "Submitting is not proof of saving");
  tracker.settled("intro", "edited", true);
  assert.equal(tracker.dirty("intro", "edited"), false);
  assert.equal(tracker.dirty("service", "unsaved service"), true);
  tracker.settled("service", "unsaved service", true);
  assert.equal(tracker.dirty("service", "unsaved service"), true, "A stale success message without a tracked submit cannot clear a new draft");
});

test("React's reset-before-result ordering cannot erase a failed action's actual draft", () => {
  const tracker = drafts.createUnsavedFormTracker();
  tracker.register("form", "original");
  let actualInput = "edited";
  tracker.submitting("form", "edited");
  if (tracker.requestReset("form")) actualInput = "original";
  assert.equal(actualInput, "edited", "Reset must wait for the action outcome");
  assert.equal(tracker.settled("form", actualInput, false), false);
  assert.equal(tracker.mayReset("form"), false);
  assert.equal(tracker.dirty("form", actualInput), true);
  if (tracker.requestReset("form")) actualInput = "original";
  assert.equal(actualInput, "edited", "A later React reset after an error must also be blocked");
  assert.equal(tracker.dirty("form", "original"), false, "Manually restoring the original text is still clean");
});

test("typing or changing custom fields during a save cannot be erased or silently treated as saved", () => {
  for (const interaction of ["native input", "custom field click"]) {
    const tracker = drafts.createUnsavedFormTracker();
    tracker.register("form", "original");
    tracker.submitting("form", "submitted");
    if (interaction === "native input") tracker.changed("form");
    else tracker.interacted("form", "new draft");
    assert.equal(tracker.requestReset("form"), false, interaction);
    tracker.settled("form", "new draft", true);
    assert.equal(tracker.mayReset("form"), false, interaction);
    assert.equal(tracker.dirty("form", "new draft"), true, interaction);
    assert.equal(tracker.dirty("form", "submitted"), false, interaction);
  }
});

test("a successful upload reset and server normalization become clean without touching another form", () => {
  const tracker = drafts.createUnsavedFormTracker();
  tracker.register("photo", "empty");
  tracker.register("credential", "saved credential");
  tracker.submitting("photo", "file and caption");
  assert.equal(tracker.requestReset("photo"), false, "Even an explicit upload reset waits until success is known");
  assert.equal(tracker.settled("photo", "file and caption", true), true);
  assert.equal(tracker.mayReset("photo"), true);
  tracker.reset("photo", "empty");
  assert.equal(tracker.dirty("photo", "empty"), false);
  assert.equal(tracker.dirty("credential", "new credential"), true);
  tracker.submitting("photo", " caption with whitespace ");
  tracker.settled("photo", "caption with whitespace", true);
  assert.equal(tracker.dirty("photo", "caption with whitespace"), false);
  tracker.retain(new Set(["credential"]));
  assert.equal(tracker.dirty("credential", "new credential"), true);
});

test("a reset after the success marker is allowed only when no newer draft needs protection", () => {
  const tracker = drafts.createUnsavedFormTracker();
  tracker.register("form", "original");
  tracker.submitting("form", "submitted");
  assert.equal(tracker.settled("form", "submitted", true), false);
  assert.equal(tracker.requestReset("form"), true);
  tracker.reset("form", "server saved value");
  assert.equal(tracker.dirty("form", "server saved value"), false);
  tracker.submitting("form", "next submitted");
  tracker.changed("form");
  tracker.settled("form", "new typing", true);
  assert.equal(tracker.requestReset("form"), false);
  assert.equal(tracker.dirty("form", "new typing"), true);
});

test("only navigation that actually leaves the current page needs a warning", () => {
  const base = { currentUrl: "https://app.theauxillium.com/dashboard/provider/onboarding?section=introduction", href: "/dashboard/provider/onboarding?section=services" };
  assert.equal(drafts.leavesCurrentPage(base), true);
  assert.equal(drafts.leavesCurrentPage({ ...base, href: "/dashboard/provider" }), true);
  assert.equal(drafts.leavesCurrentPage({ ...base, href: "https://theauxillium.com/about-us" }), true);
  for (const changes of [
    { href: "#introduction" }, { href: base.currentUrl }, { href: "mailto:help@example.test" },
    { href: "tel:123" }, { href: "javascript:void(0)" }, { target: "_blank" },
    { modified: true }, { button: 1 }, { download: true }, { defaultPrevented: true },
  ]) assert.equal(drafts.leavesCurrentPage({ ...base, ...changes }), false, JSON.stringify(changes));
});

test("the guard preserves navigation markup and provides an accessible explicit discard choice", () => {
  const compiled = ts.transpileModule(readFileSync(new URL("../src/components/provider/unsaved-changes-guard.tsx", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = { exports: {} };
  const dependencies = {
    react: React, "react/jsx-runtime": jsxRuntime,
    "react-dom": { flushSync: (callback) => callback() },
    "next/navigation": { useRouter: () => ({ push: () => assert.fail("Rendering must not navigate") }) },
    "./unsaved-form-state": drafts,
    "./unsaved-changes-guard.module.css": { default: new Proxy({}, { get: (_target, key) => key }) },
  };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, compiledModule, compiledModule.exports);
  const html = renderToStaticMarkup(React.createElement(compiledModule.exports.UnsavedChangesGuard, null,
    React.createElement("a", { href: "/dashboard/provider/onboarding?section=services" }, "Continue to services")));
  assert.match(html, /href="\/dashboard\/provider\/onboarding\?section=services"/);
  assert.match(html, /role="alertdialog"[^>]*aria-labelledby="[^"]+"[^>]*aria-describedby="[^"]+"/);
  assert.match(html, /Stay on page/);
  assert.match(html, /Discard changes and continue/);
  assert.doesNotMatch(html, /<form/);
});
