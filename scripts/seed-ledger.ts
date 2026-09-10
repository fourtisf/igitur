/**
 * Put Igitur's own 26 theses on the record.
 *
 *   LEDGER_PATH=/var/www/igitur/data/ledger.jsonl npx tsx scripts/seed-ledger.ts
 *   npm run seed:ledger      # local, writes ./data/ledger.jsonl
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * /ledger is the page the rest of the site exists to fill, and on a new deploy
 * it reads "Nothing on the record yet." A visitor cannot tell that from a site
 * where nothing works. The fix is not to invent readers — every row here is
 * Igitur committing a claim it actually published, marked `house` so nobody
 * mistakes it for someone else's conviction.
 *
 * It goes through `commit()` rather than writing lines directly, so a seeded
 * claim is validated, dated and de-duplicated exactly like any other. That
 * matters more than convenience: a seed file written by hand is a seed file
 * that can hold a claim the generator cannot build.
 *
 * ── Idempotent ───────────────────────────────────────────────────────────────
 *
 * `commit()` returns the existing entry when the same claim, book and
 * settlement date are already recorded, so running this twice adds nothing.
 * Running it on a later date DOES add entries — same claim, later settlement —
 * which is why it belongs in a first deploy, not in every update.
 *
 * ── What it cannot do ────────────────────────────────────────────────────────
 *
 * It cannot backdate. `statedAt` is the server's date at the moment of the
 * write, here as everywhere, so seeding today produces claims that are nought
 * days old. That is the honest floor: the oldest claim on this site is as old
 * as the day somebody first stated it, and no script gets to pretend otherwise.
 */
import { commit, count, LedgerError } from "../lib/ledger";
import { DEFAULT_HORIZON } from "../lib/horizon";
import { THEMES } from "../lib/universe";

async function main() {
  const before = await count();
  const failed: string[] = [];

  for (const th of THEMES) {
    try {
      await commit(th.claim, { horizon: DEFAULT_HORIZON }, { house: true });
    } catch (err) {
      failed.push(`${th.id}: ${err instanceof LedgerError ? err.message : String(err)}`);
    }
  }

  // The ledger's own count is the only honest measure of what this run did:
  // `commit` returns the existing row on a duplicate, indistinguishable from
  // one it just wrote.
  const after = await count();
  console.log(
    `[seed] ${after - before} committed, ${THEMES.length - failed.length - (after - before)} already on the record, ${after} total.`
  );
  if (failed.length) {
    console.error(`[seed] ${failed.length} could not be recorded:`);
    for (const f of failed) console.error("  " + f);
    process.exitCode = 1;
  }
}

main();
