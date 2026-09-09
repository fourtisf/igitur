import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Quote } from "./types";

/**
 * The last real price for each ticker, kept on disk.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 *
 * A vendor is not always available, and this deployment learned it the hard
 * way: throttled by the keyless source and holding a rejected key for the paid
 * one, every figure on the site fell back to a number generated from the ticker
 * text. But a price that was real forty minutes ago is still a real price. A
 * stock's last close *is* its price until the next session opens. Serving that,
 * with the timestamp it actually carries, is both more useful and more honest
 * than inventing one.
 *
 * It also survives a deploy, which the in-process cache cannot: every update
 * restarts the server, and without this the site would go back to generated
 * figures for as long as the vendor stayed unavailable — however long ago the
 * last good fetch was.
 *
 * ── What it does not do ──────────────────────────────────────────────────────
 *
 * It never invents. A stored quote keeps `synthetic: false` and its original
 * `asOf`, because that is what it is: a real figure, from a stated moment. Past
 * MAX_AGE_MS it is dropped rather than shown, so a long outage degrades to
 * generated figures — flagged as generated — instead of quietly presenting last
 * week's prices as today's.
 *
 * The file lives outside .next. Inside, every deploy would delete it, and the
 * one thing this exists to survive is a deploy.
 */

/** Long enough to cross a weekend and a holiday; short enough to notice. */
const MAX_AGE_MS = 4 * 24 * 60 * 60_000;

/** A universe of 163 names is a small file. This is a guard, not a budget. */
const MAX_ENTRIES = 2_000;

interface Entry {
  at: number;
  quote: Quote;
}

let warned = false;

function file(): string {
  const p = process.env.MARKET_CACHE_PATH || join(process.cwd(), "data", "quotes.json");
  if (!warned && /[\\/]\.next[\\/]/.test(p)) {
    warned = true;
    console.warn(
      `[market] ${p} is inside the build output and will be deleted by the next ` +
        `deploy. Set MARKET_CACHE_PATH to a directory outside .next.`
    );
  }
  return p;
}

let memory: Map<string, Entry> | null = null;

function load(): Map<string, Entry> {
  if (memory) return memory;
  memory = new Map();
  try {
    const raw = JSON.parse(readFileSync(file(), "utf8")) as Record<string, Entry>;
    const now = Date.now();
    for (const [ticker, e] of Object.entries(raw)) {
      // A malformed file must not take a page down, and a quote that lost its
      // honesty flag in transit must not be trusted with it.
      if (!e || typeof e.at !== "number" || !e.quote || e.quote.synthetic !== false) continue;
      if (now - e.at > MAX_AGE_MS) continue;
      memory.set(ticker.toUpperCase(), e);
    }
  } catch {
    // No file yet is the ordinary case on a fresh server, not an error.
  }
  return memory;
}

/** The last real quote for `ticker`, if one was stored and is not too old. */
export function remembered(ticker: string): Quote | null {
  const e = load().get(ticker.toUpperCase());
  if (!e) return null;
  if (Date.now() - e.at > MAX_AGE_MS) return null;
  return e.quote;
}

/** Stores real quotes. Anything flagged synthetic is ignored, by definition. */
export function remember(quotes: Iterable<Quote>): void {
  const store = load();
  const now = Date.now();
  let changed = false;

  for (const q of quotes) {
    if (q.synthetic) continue;
    store.set(q.ticker.toUpperCase(), { at: now, quote: q });
    changed = true;
  }
  if (!changed) return;

  if (store.size > MAX_ENTRIES) {
    const oldest = [...store].sort((a, b) => a[1].at - b[1].at);
    for (const [k] of oldest.slice(0, store.size - MAX_ENTRIES)) store.delete(k);
  }

  const path = file();
  try {
    mkdirSync(dirname(path), { recursive: true });
    // Written beside and renamed: a half-written file read by the next render
    // would be worse than no file at all, and rename is atomic on one volume.
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(store)), "utf8");
    renameSync(tmp, path);
  } catch (e) {
    // Prices still work from memory; only their survival across a restart is
    // lost. That is not worth failing a render for.
    if (!warned) {
      warned = true;
      console.warn(`[market] could not write ${path}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/** Exported for tests: the store outlives a single case otherwise. */
export function forgetStore(): void {
  memory = null;
}
