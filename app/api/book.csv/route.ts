import type { NextRequest } from "next/server";

import { buildBook } from "@/lib/generator";
import { slugOf } from "@/lib/hash";
import { fmtMcap, fmtPrice, getQuotes, isLive } from "@/lib/market";
import { normalizePremise } from "@/lib/premise";
import { applyPins, parsePins } from "@/lib/reweight";
import { parseDrop, parseStated, parseUniverse } from "@/lib/routes";
import { SITE } from "@/lib/site";
import { UNIVERSE_VERSION } from "@/lib/universe";

/**
 * A book as a file.
 *
 * The product currently ends in a dead end: you read the book and then nothing
 * happens. Order routing is out of scope — HANDOFF.md §14 is clear it needs a
 * broker relationship and custody, not a front end — so this is the honest
 * substitute. It does not execute anything; it hands the reader exactly what
 * they would need to act somewhere else, reasons included.
 */
export const runtime = "nodejs";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const premise = normalizePremise(q.get("p") ?? "");
  const drop = parseDrop(q.get("x") ?? undefined);
  const generated = buildBook(premise, drop);

  if (!generated.ok) {
    return new Response("No theme in this universe carries that claim.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const known = new Set(generated.holdings.filter((h) => !h.ballast).map((h) => h.t));
  const book = applyPins(generated, parsePins(q.get("w") ?? undefined, known));
  const universe = parseUniverse(q.get("u") ?? undefined) ?? UNIVERSE_VERSION;
  const stated = parseStated(q.get("d") ?? undefined);
  const quotes = await getQuotes(book.holdings.map((h) => h.t));
  const live = isLive();

  const rows: (string | number)[][] = [
    [
      "ticker",
      "name",
      "kind",
      "weight_pct",
      "role",
      "theme",
      "reason",
      "price",
      "market_cap",
      "price_is_synthetic",
    ],
    ...book.holdings.map((h) => [
      h.t,
      h.n,
      h.k,
      h.pct,
      h.ballast ? "ballast" : h.lead ? "lead" : "position",
      h.src,
      h.why,
      fmtPrice(quotes.get(h.t)?.price ?? 0),
      fmtMcap(quotes.get(h.t)?.marketCap ?? 0),
      // Stated on every row, because a spreadsheet loses the warning the page
      // carries and these figures are generated from the ticker text.
      live ? "no" : "yes",
    ]),
  ];

  // Provenance after a blank line, so a parser reading the header row is not
  // confused by it but a human opening the file still sees where it came from.
  const meta: (string | number)[][] = [
    [],
    ["premise", book.premise],
    ["theme", book.theme.name],
    ["risk", book.risk],
    ["horizon", book.horizon],
    ["confidence_pct", book.confidence],
    ["universe_version", universe],
    ["stated_on", stated ?? "not recorded"],
    ["edited_by_reader", book.edited ? "yes" : "no"],
    ["source", `${SITE.url}/b/${slugOf(book.premise)}`],
    ["note", "Research output. Not investment advice. Nothing here places an order."],
  ];

  const csv = [...rows, ...meta].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const filename = `igitur-${slugOf(book.premise).slice(0, 48)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
