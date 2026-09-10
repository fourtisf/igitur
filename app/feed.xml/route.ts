import { buildBook } from "@/lib/generator";
import { isSettled } from "@/lib/horizon";
import { all } from "@/lib/ledger";
import { absolute, SITE } from "@/lib/site";
import { trackBook } from "@/lib/track";

/**
 * The record, as a feed.
 *
 * A claim is committed and then nothing happens: no account, no email, no
 * notification, and the author has to remember a URL to ever see how it went.
 * The measurement is the entire payoff, and it was never delivered.
 *
 * A feed fixes that without learning anything about anybody. Two kinds of item,
 * because a claim has two moments worth hearing about — the day it was made,
 * and the day it was judged. They carry different guids so a reader is told
 * about both rather than seeing one item quietly change its mind.
 */
export const revalidate = 600;

/** The most recent events. A record is not a firehose. */
const LIMIT = 60;

/**
 * Text inside XML.
 *
 * Premises are written by strangers and go into a document a reader's client
 * parses. Ampersand first, or the escapes escape each other.
 */
export function escapeXml(text: string): string {
  return (
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      // XML 1.0 cannot represent most control characters at all, escaped or
      // not: a single stray byte makes the whole feed unparseable.
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  );
}

/** RFC 822, which is what RSS wants and what readers actually parse. */
export function rfc822(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  return Number.isNaN(d.getTime()) ? "" : d.toUTCString();
}

interface Item {
  guid: string;
  url: string;
  title: string;
  body: string;
  date: string;
}

export async function GET() {
  const entries = await all();
  const items: Item[] = [];

  for (const e of entries) {
    const url = absolute(`/p/${e.id}`);
    items.push({
      guid: `${url}#stated`,
      url,
      title: `Claim: ${e.premise}`,
      body: e.settlesAt
        ? `Stated on ${e.statedAt}. It is judged on ${e.settlesAt}, and the record then stops.`
        : `Stated on ${e.statedAt}. Open-ended: this claim carries no settlement date.`,
      date: e.statedAt,
    });

    if (!isSettled(e.settlesAt)) continue;

    // Only settled claims are measured here. Tracking every open one would
    // make a feed request cost as much as the whole ledger page.
    const book = buildBook(e.premise, e.drop ?? []);
    if (!book.ok) continue;
    const days = Math.round(
      (Date.parse(e.settlesAt + "T00:00:00Z") - Date.parse(e.statedAt + "T00:00:00Z")) / 86_400_000
    );
    const track = await trackBook(book, e.statedAt, days, e.settlesAt ?? null);
    const held = track.bookEnd >= track.indexEnd;

    items.push({
      guid: `${url}#settled`,
      url,
      title: `${held ? "Held" : "Failed"}: ${e.premise}`,
      body:
        `Settled on ${e.settlesAt}. The book returned ${track.bookEnd.toFixed(1)}% against the ` +
        `index's ${track.indexEnd.toFixed(1)}%, so the claim ${held ? "held" : "failed"}. ` +
        `The figure does not move again.` +
        (track.live ? "" : " Drawn from the premise rather than from market data."),
      date: e.settlesAt!,
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${escapeXml(SITE.name)} — the record</title>`,
    `<link>${escapeXml(absolute("/ledger"))}</link>`,
    `<description>${escapeXml(
      "Dated claims and the day each one is judged. Losers included."
    )}</description>`,
    "<language>en</language>",
    `<atom:link href="${escapeXml(absolute("/feed.xml"))}" rel="self" type="application/rss+xml"/>`,
    ...items.slice(0, LIMIT).flatMap((i) => [
      "<item>",
      `<title>${escapeXml(i.title)}</title>`,
      `<link>${escapeXml(i.url)}</link>`,
      `<guid isPermaLink="false">${escapeXml(i.guid)}</guid>`,
      `<pubDate>${rfc822(i.date)}</pubDate>`,
      `<description>${escapeXml(i.body)}</description>`,
      "</item>",
    ]),
    "</channel>",
    "</rss>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
