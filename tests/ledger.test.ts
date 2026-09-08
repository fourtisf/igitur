/**
 * The record.
 *
 * The one part of this site that writes anything, so the one part where a bug
 * is permanent. These pin the properties the page's whole claim rests on: the
 * date comes from the server, a claim the generator refuses is not recorded,
 * and the file surviving a crash mid-write does not take the page down.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { all, commit, get, LedgerError, MAX_PREMISE } from "../lib/ledger";
import { UNIVERSE_VERSION } from "../lib/universe";

// The ledger reads LEDGER_PATH on every call rather than at import, so setting
// it here is enough and no dynamic import is needed — which also keeps this
// file free of top-level await, which the test runner cannot compile.
const dir = mkdtempSync(join(tmpdir(), "ledger-"));
process.env.LEDGER_PATH = join(dir, "ledger.jsonl");

test("a committed claim is dated by the server, not by the caller", async () => {
  // This is the whole point. Everywhere else on the site the "stated" date is a
  // query parameter, so every performance figure is arrangeable by whoever
  // shares the link. Here it is not, and there is deliberately no way to pass
  // one in — a caller cannot even try.
  const e = await commit("nuclear restarts will power the datacentre buildout");
  assert.match(e.statedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(e.statedAt, new Date().toISOString().slice(0, 10));
  assert.equal(e.universe, UNIVERSE_VERSION);
  assert.ok(e.id.length >= 10, "the id must not be short enough to enumerate");
});

test("the same claim is recorded once, and keeps its first date", async () => {
  // Otherwise the record fills with copies of whatever is popular, and the
  // person who said it first loses the only thing they earned by being early.
  const a = await commit("solar and storage will be the cheapest new power");
  const b = await commit("  Solar and storage will be the cheapest new power  ");
  assert.equal(b.id, a.id);
  assert.equal(b.statedAt, a.statedAt);
});

test("a claim the generator refuses is never recorded", async () => {
  // A record of claims that produce no book is a record of nothing, and it is
  // the obvious way to fill the file with junk.
  await assert.rejects(() => commit("the dollar will lose reserve status"), LedgerError);
  await assert.rejects(() => commit("hello"), LedgerError);
  await assert.rejects(() => commit("x".repeat(MAX_PREMISE + 1)), LedgerError);
});

test("entries come back newest first and are addressable by id", async () => {
  const e = await commit("robots will do the physical work in ageing countries");
  const list = await all();
  assert.equal(list[0].id, e.id, "newest must lead");
  assert.deepEqual(await get(e.id), e);
  assert.equal(await get("does-not-exist"), null);
});

test("a torn final line does not take the page down", async () => {
  // A crash mid-append leaves half a line. The record is append-only precisely
  // so that the loss is bounded to that one entry.
  const before = (await all()).length;
  appendFileSync(process.env.LEDGER_PATH!, '{"id":"broken","premise":', "utf8");
  const after = await all();
  assert.equal(after.length, before, "the good entries must still read");
});

test("a missing ledger is an empty record, not an error", async () => {
  const old = process.env.LEDGER_PATH;
  process.env.LEDGER_PATH = join(dir, "nothing-here.jsonl");
  assert.deepEqual(await all(), []);
  process.env.LEDGER_PATH = old;
});

test("the file stays one JSON object per line", async () => {
  // The format is the durability story: readable with cat, recoverable by hand,
  // and safe to append to from one process. A change here needs a migration.
  const lines = readFileSync(process.env.LEDGER_PATH!, "utf8").split("\n").filter((l) => l.trim());
  for (const l of lines.slice(0, -1)) {
    const o = JSON.parse(l);
    assert.ok(o.id && o.premise && o.statedAt && o.theme);
  }
});

test("a ledger written by a future version still reads", async () => {
  // Unknown fields must be ignored rather than rejected, or a rollback after a
  // schema change would make the record unreadable.
  const p = join(dir, "future.jsonl");
  writeFileSync(
    p,
    JSON.stringify({
      id: "abc12345", premise: "compute is the binding constraint",
      universe: 99, statedAt: "2030-01-01", theme: "compute", signature: "unknown",
    }) + "\n"
  );
  const old = process.env.LEDGER_PATH;
  process.env.LEDGER_PATH = p;
  const list = await all();
  assert.equal(list.length, 1);
  assert.equal(list[0].statedAt, "2030-01-01");
  process.env.LEDGER_PATH = old;
});
