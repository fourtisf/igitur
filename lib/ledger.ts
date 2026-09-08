import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

import { buildBook } from "./generator";
import { applyPins, parsePins } from "./reweight";
import { normalizePremise } from "./premise";
import { UNIVERSE_VERSION } from "./universe";

/**
 * The record of what people said, and when.
 *
 * Until now nothing on this site was remembered. A visitor stated a belief, got
 * a book, closed the tab, and it was gone — while /track measured "since the
 * premise was stated" from a date in the URL that the reader could set to
 * anything. A tool whose whole claim is that beliefs can be checked against
 * what happened could not check a single one.
 *
 * This is the smallest thing that fixes it: an append-only public record. A
 * premise is committed on purpose, by someone who wants it on the record, and
 * from that moment the stated date is the server's, not a query parameter.
 *
 * ── Why a file and not a database ────────────────────────────────────────────
 *
 * One line of JSON per commitment, appended. No dependency to install, no
 * native module to compile on the server, nothing to migrate, and the whole
 * thing is readable with `cat`. Writes come from one pm2 fork process, and a
 * short line opened with O_APPEND lands atomically on Linux, so concurrent
 * commits interleave safely rather than tearing.
 *
 * This holds to roughly the low tens of thousands of entries, after which the
 * ledger page should page rather than read the file whole. That is a real
 * limit, written down rather than discovered.
 *
 * ── What it does not store ───────────────────────────────────────────────────
 *
 * No name, no email, no address, no cookie, no identifier of any kind. /legal
 * promises the site does not track its readers, and committing a premise must
 * not become the exception. A row is a claim and a date. It cannot be traced to
 * a person, which is also why it cannot be edited or withdrawn later.
 */

export interface Entry {
  /** Short, URL-safe, unguessable enough that entries are not enumerable. */
  id: string;
  premise: string;
  /** Which universe built the book, so an old claim stays reproducible. */
  universe: number;
  /** ISO date the server witnessed it. Never taken from the request. */
  statedAt: string;
  /** The theme that won, stored so the ledger renders without rebuilding. */
  theme: string;
  /**
   * Holdings the author removed, and weights they set — the two things that
   * make a book theirs rather than the generator's default.
   *
   * Both optional. Entries written before forking existed have neither, and
   * must keep reading as the plain book they were.
   */
  drop?: string[];
  weights?: string;
}

/**
 * Where the record lives.
 *
 * LEDGER_PATH must point OUTSIDE the build output. The standalone server runs
 * with its working directory inside .next/standalone, and every deploy replaces
 * .next wholesale — so a ledger left to default there is destroyed on the next
 * update, silently and permanently. The deploy scripts set it to
 * /var/www/igitur/data/ledger.jsonl; the warning below is for every other way
 * this gets run.
 */
function file(): string {
  const p = process.env.LEDGER_PATH || join(process.cwd(), "data", "ledger.jsonl");
  if (!warned && /[\\/]\.next[\\/]/.test(p)) {
    warned = true;
    console.warn(
      `[ledger] ${p} is inside the build output and will be deleted by the next ` +
        `deploy. Set LEDGER_PATH to a directory outside .next.`
    );
  }
  return p;
}
let warned = false;

/** A premise longer than this is not a premise. */
export const MAX_PREMISE = 240;

export class LedgerError extends Error {}

/** What makes a book someone's own, beyond the premise. */
export interface BookShape {
  drop?: string[];
  weights?: string;
}

/**
 * Two entries are the same claim only if the premise AND the book match. The
 * point of forking is that two people can hold the same belief and size it
 * differently, and the record should show both.
 */
function shapeKey(premise: string, drop: string[], weights: string): string {
  return [premise.toLowerCase(), [...drop].sort().join(","), weights].join("|");
}

function newId(): string {
  // 8 bytes of base64url: short enough to read aloud, wide enough that the
  // ledger cannot be walked by guessing.
  return randomBytes(8).toString("base64url");
}

/**
 * Put a premise on the record.
 *
 * Refuses anything the generator itself would refuse. A record of claims the
 * tool cannot even build a book for would be a record of nothing, and it is the
 * obvious way to fill the file with junk.
 */
export async function commit(raw: string, shape: BookShape = {}): Promise<Entry> {
  const premise = normalizePremise(raw);
  if (premise.length < 12) throw new LedgerError("Too short to be a claim about anything.");
  if (premise.length > MAX_PREMISE) throw new LedgerError("Too long. State one belief.");

  const drop = (shape.drop ?? []).filter((t) => /^[A-Z.\-]{1,8}$/.test(t)).slice(0, 24);
  const weights = typeof shape.weights === "string" ? shape.weights.slice(0, 200) : "";

  const generated = buildBook(premise, drop);
  if (!generated.ok) {
    throw new LedgerError("No theme in this universe carries that claim, so there is nothing to record.");
  }
  // A fork is only a fork if the weights survive being applied. Storing a
  // string the reader page cannot reproduce would put a book on the record that
  // nobody, including this server, can rebuild.
  const known = new Set(generated.holdings.map((h) => h.t));
  const book = weights ? applyPins(generated, parsePins(weights, known)) : generated;
  if (!book.holdings.length) {
    throw new LedgerError("That leaves no holdings to record.");
  }

  // The same claim with the same book, already recorded: return the original
  // rather than letting the ledger fill with duplicates of whatever is popular.
  // The first person to state it keeps the date, which is the whole point of a
  // record. A different set of weights is a different claim about the same
  // belief, so it gets its own entry.
  const key = shapeKey(premise, drop, weights);
  const existing = (await all()).find((e) => shapeKey(e.premise, e.drop ?? [], e.weights ?? "") === key);
  if (existing) return existing;

  const entry: Entry = {
    id: newId(),
    premise,
    universe: UNIVERSE_VERSION,
    // The server's date. A date the caller could set would make every
    // performance figure on this site unfalsifiable.
    statedAt: new Date().toISOString().slice(0, 10),
    theme: generated.theme.id,
    ...(drop.length ? { drop } : {}),
    ...(weights ? { weights } : {}),
  };

  const path = file();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

/** Every entry, newest first. Malformed lines are skipped, never thrown on. */
export async function all(): Promise<Entry[]> {
  let text: string;
  try {
    text = await readFile(file(), "utf8");
  } catch {
    // No ledger yet is not an error; it is a site nobody has committed to.
    return [];
  }
  const out: Entry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as Entry;
      if (e && typeof e.id === "string" && typeof e.premise === "string") out.push(e);
    } catch {
      // A half-written final line survives a crash without taking the page down.
    }
  }
  return out.reverse();
}

export async function get(id: string): Promise<Entry | null> {
  return (await all()).find((e) => e.id === id) ?? null;
}

export async function count(): Promise<number> {
  return (await all()).length;
}
