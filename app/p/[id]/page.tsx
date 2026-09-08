import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Bar } from "@/components/Bar";
import { Holdings } from "@/components/Holdings";
import { TrackChart } from "@/components/TrackChart";
import { buildBook } from "@/lib/generator";
import { get } from "@/lib/ledger";
import { getQuotes } from "@/lib/market";
import { bookHref, daysSince } from "@/lib/routes";
import { trackBook } from "@/lib/track";
import { twitterCard } from "@/lib/twitter-card";
import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";

/**
 * One claim, on the record.
 *
 * Everywhere else on this site a book is rebuilt from the URL, which means the
 * reader controls every input — including the date /track measures from. Here
 * the date came from the server on the day it was written and cannot be edited
 * afterwards, so the performance below is the one number on this site that
 * nobody can arrange.
 */

type Params = { id: string };

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const entry = await get(id);
  if (!entry) return { title: "No such record", robots: { index: false, follow: true } };

  const title = entry.premise.length > 56 ? entry.premise.slice(0, 55).trimEnd() + "…" : entry.premise;
  return {
    title: `On the record: ${title}`,
    description: `Stated on ${entry.statedAt} and measured against the index ever since. The date came from the server, not from the link.`,
    alternates: { canonical: `/p/${id}` },
    openGraph: {
      url: `/p/${id}`,
      title: `On the record — ${SITE.name}`,
      description: entry.premise,
      images: [{ url: pageOg("home"), width: 1200, height: 630 }],
    },
    twitter: twitterCard(pageOg("home")),
  };
}

function human(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function RecordPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const entry = await get(id);
  if (!entry) notFound();

  const book = buildBook(entry.premise);
  // A claim recorded under an older universe could stop matching if a theme
  // were ever removed. Say so rather than 500.
  if (!book.ok) {
    return (
      <section className="shell pgtop">
        <span className="kick rv">On the record</span>
        <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "24ch" }}>
          This claim no longer builds a book.
        </h1>
        <p className="sub rv" style={{ marginTop: 18 }}>
          It was recorded on {human(entry.statedAt)} against universe v{entry.universe}. The record
          stands; the universe has moved since.
        </p>
        <p style={{ marginTop: 18, fontSize: 18 }}>{entry.premise}</p>
      </section>
    );
  }

  const days = daysSince(entry.statedAt) ?? 0;
  const [quotes, track] = await Promise.all([
    getQuotes(book.holdings.map((h) => h.t)),
    trackBook(book, entry.statedAt, days),
  ]);

  const ahead = track.bookEnd >= track.indexEnd;

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">
        On the record · <Link href="/ledger">all claims</Link>
      </span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "24ch" }}>
        {entry.premise}
      </h1>

      <p className="notice rv" style={{ marginTop: 18 }}>
        Stated on <b>{human(entry.statedAt)}</b>, {days === 0 ? "today" : `${days} days ago`}, and
        measured ever since. That date was written by the server when this claim was committed. It
        is not in the link and cannot be changed — which is what makes the figure below worth
        anything.
      </p>

      {track.live ? (
        <p className="notice rv" style={{ marginTop: 14 }}>
          Since then the book is <b>{track.bookEnd >= 0 ? "+" : ""}{track.bookEnd.toFixed(1)}%</b>{" "}
          and the index <b>{track.indexEnd >= 0 ? "+" : ""}{track.indexEnd.toFixed(1)}%</b> — the
          book is {ahead ? "ahead" : "behind"}.
          {track.missing.length
            ? ` ${track.missing.length} holding${track.missing.length > 1 ? "s" : ""} could not be
               priced (${track.missing.join(", ")}) and their weight was spread across the rest.`
            : ""}
        </p>
      ) : (
        <p className="notice warn rv" style={{ marginTop: 14 }}>
          The performance below is synthetic — no market data vendor is configured, so it is drawn
          from the premise itself and reflects nothing. The date is real; the return is not, and
          will be the moment real prices are switched on.
        </p>
      )}

      <div style={{ marginTop: 26 }}>
        <TrackChart book={book} track={track} />
      </div>

      <div style={{ marginTop: 34 }}>
        <Bar holdings={book.holdings} />
        <Holdings holdings={book.holdings} quotes={quotes} />
      </div>

      <div className="hero-cta rv" style={{ justifyContent: "flex-start", marginTop: 34 }}>
        <Link className="b2" href={bookHref(entry.premise, [], { universe: entry.universe })}>
          Open as a working book
        </Link>
        <Link className="b2" href="/ledger">
          Every claim on the record
        </Link>
      </div>
    </section>
  );
}
