/**
 * How long a claim stands, and what happens when the date arrives.
 *
 * The record used to hold only open-ended claims, which sounds generous and is
 * the opposite: a belief with no deadline can never be wrong, only early.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { escapeIcs, fold } from "../app/api/claim.ics/route";
import {
  DEFAULT_HORIZON,
  HORIZONS,
  horizonLabel,
  isHorizon,
  isSettled,
  daysUntil,
  monthsBetween,
  settlesOn,
} from "../lib/horizon";

test("a settlement date is the stated date plus the chosen months", () => {
  assert.equal(settlesOn("2026-09-10", 3), "2026-12-10");
  assert.equal(settlesOn("2026-09-10", 12), "2027-09-10");
  assert.equal(settlesOn("2026-09-10", 60), "2031-09-10");
});

test("month arithmetic does not overflow into a month nobody chose", () => {
  // Every naive implementation makes 31 January plus one month into 3 March,
  // which would settle a claim in a month its author never picked.
  assert.equal(settlesOn("2026-01-31", 1), "2026-02-28");
  assert.equal(settlesOn("2028-01-31", 1), "2028-02-29", "and a leap year is still February");
  assert.equal(settlesOn("2026-05-31", 1), "2026-06-30");
});

test("a stored settlement reads back as the horizon that was chosen", () => {
  for (const h of HORIZONS) {
    assert.equal(monthsBetween("2026-09-10", settlesOn("2026-09-10", h)), h);
  }
  assert.equal(monthsBetween("2026-01-31", settlesOn("2026-01-31", 1)), 1, "even when pulled back");
});

test("only the offered horizons are accepted", () => {
  // Anything else would let a hand-edited request write an arbitrary date.
  assert.equal(isHorizon(12), true);
  assert.equal(isHorizon(13), false);
  assert.equal(isHorizon("12"), false);
  assert.equal(isHorizon(0), false);
  assert.equal(isHorizon(Infinity), false);
  assert.equal(isHorizon(null), false);
  assert.ok(isHorizon(DEFAULT_HORIZON));
});

test("a claim settles on its date and not before", () => {
  const day = Date.parse("2027-09-10T00:00:00Z");
  assert.equal(isSettled("2027-09-10", day - 1), false, "the day before is still open");
  assert.equal(isSettled("2027-09-10", day), true);
  assert.equal(isSettled("2027-09-10", day + 86_400_000), true);
});

test("an open-ended claim never settles", () => {
  // Entries recorded before horizons existed are left as what they were rather
  // than backdated into something they never said.
  assert.equal(isSettled(undefined), false);
  assert.equal(isSettled(null), false);
  assert.equal(daysUntil(undefined), null);
});

test("days until settlement count down and then go negative", () => {
  const now = Date.parse("2026-09-10T12:00:00Z");
  assert.equal(daysUntil("2026-09-11", now), 1);
  assert.ok((daysUntil("2026-09-01", now) ?? 0) < 0);
});

test("horizons read as a person would say them", () => {
  assert.equal(horizonLabel(3), "3 months");
  assert.equal(horizonLabel(12), "1 year");
  assert.equal(horizonLabel(24), "2 years");
  assert.equal(horizonLabel(60), "5 years");
});

// ── The calendar file ────────────────────────────────────────────────────────

test("a premise cannot smuggle extra events into a reader's calendar", () => {
  // This is the whole risk of the .ics route: a premise written by a stranger
  // goes into a line-delimited format, and an unescaped newline would append
  // arbitrary calendar properties to everyone who downloads it.
  const attack = "Buy this\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Send money";
  const out = escapeIcs(attack);
  assert.ok(!out.includes("\r"), "no carriage return survives");
  assert.ok(!out.includes("\n"), "no line feed survives");
  assert.ok(out.includes("\\nEND:VEVENT"), "it is preserved as text, not dropped silently");
});

test("escapes are applied in an order that does not escape each other", () => {
  // Backslash last would turn an escaped semicolon back into two characters.
  assert.equal(escapeIcs("a;b,c\\d"), "a\\;b\\,c\\\\d");
});

test("control characters are removed rather than passed to a parser", () => {
  assert.equal(escapeIcs("ok\u0000\u0007\u007fdone"), "okdone");
});

test("a long line is folded, and never through the middle of a character", () => {
  const line = "SUMMARY:" + "é".repeat(90);
  const folded = fold(line);
  const parts = folded.split("\r\n ");
  assert.ok(parts.length > 1, "it was folded");
  for (const p of parts) {
    assert.ok(Buffer.byteLength(p, "utf8") <= 75, `a line ran to ${Buffer.byteLength(p, "utf8")}`);
  }
  // Unfolding restores exactly what went in.
  assert.equal(parts.join(""), line);
});

test("a short line is left alone", () => {
  assert.equal(fold("VERSION:2.0"), "VERSION:2.0");
});
