/**
 * The images, checked against the product they advertise.
 *
 * Every card in brand/x is built from book.json, and book.json is a snapshot.
 * A snapshot is exactly as honest as the day it was taken: add a thesis to the
 * universe and the banner still says 26, which is the same failure /status
 * exists to prevent, printed at 3200×1800 and posted to strangers.
 *
 * So the numbers on the images are pinned to the numbers in the universe. When
 * this test fails, the universe moved and the images need rebuilding — that is
 * the message, not a bug.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { MIN_PCT, MAX_PCT } from "../lib/reweight";
import { NAMES, THEMES, THEME_BY_ID } from "../lib/universe";

const book = JSON.parse(readFileSync("brand/x/book.json", "utf8")) as {
  theme: string;
  themeCount: number;
  nameCount: number;
  holdings: { t: string; pct: number; why: string; lead: boolean }[];
};

test("the figures printed on the cards are the universe's own", () => {
  assert.equal(book.themeCount, THEMES.length, "brand/x/book.json is stale — rebuild the images");
  assert.equal(book.nameCount, NAMES, "brand/x/book.json is stale — rebuild the images");
});

test("the assistant banner quotes a holding that still exists, with its published reason", () => {
  // The banner prints the lead holding's weight and the sentence under it. A
  // reason that no longer matches the universe is a quotation the site never
  // made.
  const lead = book.holdings.find((h) => h.lead) ?? book.holdings[0];
  const theme = THEMES.find((t) => t.name === book.theme);
  assert.ok(theme, `${book.theme} is no longer a published thesis`);
  const asset = theme!.assets.find((a) => a.t === lead.t);
  assert.ok(asset, `${lead.t} is no longer in ${book.theme}`);
  assert.equal(asset!.why, lead.why, "the reason on the banner must be the reason on the page");
  assert.ok(asset!.c > 0 && asset!.c <= 100, "and its conviction must be a published score");
});

test("the banner's floor and cap are read from the formula, never typed", () => {
  const src = readFileSync("brand/x/make-ask.mjs", "utf8");
  assert.match(src, /constOf\("MIN_PCT"\)/);
  assert.match(src, /constOf\("MAX_PCT"\)/);
  assert.match(src, /convictionOf\(/, "the conviction score too");
  // If these ever drift, the sentence on the image stops describing the site.
  assert.ok(MIN_PCT < MAX_PCT, "a floor above the cap would make the banner nonsense");
  assert.ok(THEME_BY_ID.size === THEMES.length);
});

test("the launch card reads the address from the site, and checks it is one", () => {
  // A banner is what somebody compares against the address in their wallet, so
  // it must carry the deployed string and nothing else — not a snapshot in
  // book.json, which is where every other figure on these cards comes from and
  // is exactly the wrong place for this one.
  const card = readFileSync("brand/x/make-token.mjs", "utf8");
  assert.match(card, /lib", "site\.ts"/, "the address comes from lib/site.ts");
  assert.match(card, /\^0x\[0-9a-fA-F\]\{40\}\$/, "and is checked before it is drawn");
  const thread = readFileSync("brand/x/make-thread.mjs", "utf8");
  assert.match(thread, /contractAddress:\\s\*"\(0x\[0-9a-fA-F\]\{40\}\)"/, "card 6 reads it too");
  assert.ok(!/"address":\s*"0x/.test(readFileSync("brand/x/book.json", "utf8")), "never in the snapshot");
});
