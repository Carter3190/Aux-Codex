import assert from "node:assert/strict";
import { test } from "node:test";
import { validDate, dateFromDisplay, dateToDisplay, dateAllowed, timeFromDisplay, timeToDisplay, numericError } from "../src/components/ui/field-values.ts";

test("typed dates preserve calendar days and reject impossible dates", () => {
  assert.equal(dateFromDisplay("2/29/2028"), "2028-02-29");
  assert.equal(dateToDisplay("2028-02-29"), "02/29/2028");
  for (const input of ["2027-02-29", "2028-02-30", "2026-04-31", "0000-01-01"]) assert.equal(validDate(input), false, input);
  assert.equal(dateFromDisplay("02/29/2027"), "");
  assert.equal(dateFromDisplay(""), "");
  assert.equal(dateAllowed("2026-11-10", "2026-11-10", "2026-11-30"), true);
  assert.equal(dateAllowed("2026-11-09", "2026-11-10", "2026-11-30"), false);
  assert.equal(dateAllowed("2026-12-01", "2026-11-10", "2026-11-30"), false);
});

test("time entry keeps noon, midnight, and exact minutes in existing submission format", () => {
  for (const [display, submitted] of [["12:00 AM", "00:00"], ["12:00 PM", "12:00"], ["9:07 AM", "09:07"], ["5:43 PM", "17:43"], ["11:59:13 PM", "23:59:13"]]) {
    assert.equal(timeFromDisplay(display), submitted);
    assert.equal(timeFromDisplay(timeToDisplay(submitted)), submitted);
  }
  for (const input of ["13:00 PM", "09:60", "24:00", "12:60 AM", ""]) assert.equal(timeFromDisplay(input), "", input);
});

test("number validation preserves blanks, whole-year limits, and money precision", () => {
  assert.equal(numericError("", 0, 80, 1), "");
  assert.equal(numericError("0", 0, 80, 1), "");
  assert.equal(numericError("80", 0, 80, 1), "");
  assert.notEqual(numericError("81", 0, 80, 1), "");
  assert.notEqual(numericError("5.5", 0, 80, 1), "");
  assert.equal(numericError("20", 0, 250, 1), "");
  assert.equal(numericError("125.01", 1, 1000000, 0.01), "");
  assert.notEqual(numericError("125.005", 1, 1000000, 0.01), "");
  assert.notEqual(numericError("NaN", 1, 1000000, 0.01), "");
});
