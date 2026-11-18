import assert from "node:assert/strict";
import { test } from "node:test";
import { getProviderHomeDestination, getProviderSearchFilters } from "../src/lib/marketplace/provider-search.ts";

test("legacy directory links retain keyword and area as encoded home filters", () => {
  const destination = getProviderHomeDestination({ q: "  repair & care  ", area: " Grand Rapids / Lakeshore " });
  const url = new URL(destination, "https://app.theauxillium.com");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("q"), "repair & care");
  assert.equal(url.searchParams.get("area"), "Grand Rapids / Lakeshore");
  assert.equal(url.origin, "https://app.theauxillium.com");
});

test("repeated and overlong filters keep the directory's first-value and length limits", () => {
  const params = { q: ["  " + "x".repeat(150), "ignored"], area: ["  West Michigan  ", "ignored"] };
  const filters = getProviderSearchFilters(params);
  assert.equal(filters.search, "x".repeat(100));
  assert.equal(filters.area, "West Michigan");
  const destination = new URL(getProviderHomeDestination(params), "https://app.theauxillium.com");
  assert.equal(destination.searchParams.get("q"), filters.search);
  assert.equal(destination.searchParams.get("area"), filters.area);
});

test("empty searches return the clean home address and never redirect to supplied text", () => {
  assert.equal(getProviderHomeDestination({}), "/");
  assert.equal(getProviderHomeDestination({ q: [], area: ["   ", "ignored"] }), "/");
  const destination = new URL(getProviderHomeDestination({ q: "//outside.test/?next=https://other.test", area: "A+B" }), "https://app.theauxillium.com");
  assert.equal(destination.origin, "https://app.theauxillium.com");
  assert.equal(destination.pathname, "/");
  assert.equal(destination.searchParams.get("q"), "//outside.test/?next=https://other.test");
  assert.equal(destination.searchParams.get("area"), "A+B");
  assert.equal(destination.searchParams.has("next"), false);
});
