import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Bar } from "./types";

/**
 * Daily closes, kept on disk — for exactly the reason `store.ts` keeps quotes.
 *
 * ── Why this had to exist ────────────────────────────────────────────────────
 *
 * store.ts says its own point is that it "survives a deploy, which the
 * in-process cache cannot". That was true of quotes and was never done for
 * history, and history is now the larger bill.
 *
 * /ledger measures every committed claim against the index, which needs a
 * series per holding — 144 distinct names once Igitur's own 26 theses were on
 * the record. Those series lived in a `Map` in the process, so every
 * `pm2 restart` dropped them. Every deploy restarts. And the deploy's own
 * verification step opens /ledger, so each deploy paid the full 144-name sweep
 * before a reader had arrived.
 *
 * Eight deploys in an evening is 1150 credits against an allowance of 800,
 * which is precisely what the vendor reported: 1299 used, every source
 * throttled, and the site quietly serving stored closes. The daily budget was
 * never the problem. Losing the cache eight times was.
 *
 * ── What it does not do ──────────────────────────────────────────────────────
 *
 * It never invents and never extends a series. Bars are stored exactly as the
 * vendor returned them, and dropped whole once stale rather than topped up,
 * because a series stitched from two fetches is a series nobody can check.
 *
 * A separate file from quotes.json on purpose: quotes are rewritten on every
 * refresh and are tiny, while these are large and rewritten rarely. Sharing one
 * file would make every quote write carry a megabyte of bars.
 */

/** A stale series is refetched rather than shown. Matches HISTORY_TTL's intent. */
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/** 144 names today. The cap is a guard against a runaway key space, not a budget. */
const MAX_ENTRIES = 4_000;

interface Entry {
  at: number;
  bars: Bar[];
}

let warned = false;

function file(): string {
  const explicit = process.env.MARKET_HISTORY_PATH;
  if (explicit) return explicit;
  // Beside the quote store by default, so one MARKET_CACHE_PATH setting places
  // both and a deploy cannot put one inside .next and the other outside it.
  const quotes = process.env.MARKET_CACHE_PATH || join(process.cwd(), "data", "quotes.json");
  return join(dirname(quotes), "history.json");
}

let memory: Map<string, Entry> | null = null;

function load(): Map<string, Entry> {
  if (memory) return memory;
  memory = new Map();
  try {
    const raw = JSON.parse(readFileSync(file(), "utf8")) as Record<string, Entry>;
    const now = Date.now();
    for (const [key, e] of Object.entries(raw)) {
      // A malformed file must not take a page down.
      if (!e || typeof e.at !== "number" || !Array.isArray(e.bars)) continue;
      if (now - e.at > MAX_AGE_MS) continue;
      // A bar that lost its shape in transit is not a bar.
      const bars = e.bars.filter(
        (b) => b && typeof b.date === "string" && typeof b.close === "number"
      );
      if (bars.length !== e.bars.length) continue;
      memory.set(key, { at: e.at, bars });
    }
  } catch {
    // No file yet is the ordinary case on a fresh server, not an error.
  }
  return memory;
}

/** A stored series and its age, or null when absent or too old. */
export function rememberedBars(key: string): { bars: Bar[]; at: number } | null {
  const e = load().get(key);
  if (!e) return null;
  if (Date.now() - e.at > MAX_AGE_MS) return null;
  return { bars: e.bars, at: e.at };
}

/**
 * Stores a series. An empty one is never written: the vendor not answering is
 * a question, not a result, and persisting it would keep a tracked claim blank
 * across restarts long after the source came back.
 */
export function rememberBars(key: string, bars: Bar[]): void {
  if (!bars.length) return;
  const store = load();
  store.set(key, { at: Date.now(), bars });

  if (store.size > MAX_ENTRIES) {
    const oldest = [...store].sort((a, b) => a[1].at - b[1].at);
    for (const [k] of oldest.slice(0, store.size - MAX_ENTRIES)) store.delete(k);
  }

  const path = file();
  try {
    mkdirSync(dirname(path), { recursive: true });
    // Written beside and renamed, as in store.ts: a half-written file read by
    // the next render is worse than no file, and rename is atomic on one volume.
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(store)), "utf8");
    renameSync(tmp, path);
  } catch (e) {
    // Tracking still works from memory; only its survival across a restart is
    // lost. That is not worth failing a render for.
    if (!warned) {
      warned = true;
      console.warn(`[market] could not write ${path}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/** Exported for tests: the store outlives a single case otherwise. */
export function forgetHistoryStore(): void {
  memory = null;
}
