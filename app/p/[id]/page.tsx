import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Bar } from "@/components/Bar";
import { Holdings } from "@/components/Holdings";
import { TrackChart } from "@/components/TrackChart";
import { buildBook } from "@/lib/generator";
import { applyPins, parsePins } from "@/lib/reweight";
import { get } from "@/lib/ledger";
import { daysUntil, horizonLabel, isSettled, monthsBetween } from "@/lib/horizon";
import { getQuotes } from "@/lib/market";
import { icsHref } from "@/lib/routes";
import { bookHref, daysSince } from "@/lib/routes";
import { trackBook } from "@/lib/track";
import { twitterCard } from "@/lib/twitter-card";
import { recordOg } from "@/lib/og-pages";
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
      images: [{ url: recordOg(id), width: 1200, height: 630, alt: entry.premise }],
    },
    twitter: twitterCard(recordOg(id)),
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

  // Rebuild the book exactly as it was committed. Rendering the generator's
  // default here instead would show a book the author never stated, and measure
  // it as though they had.
  const generated = buildBook(entry.premise, entry.drop ?? []);
  const book = generated.ok && entry.weights
    ? applyPins(generated, parsePins(entry.weights, new Set(generated.holdings.map((h) => h.t))))
    : generated;
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

  // A settled claim is measured to its settlement date and never past it. A
  // verdict that keeps moving after it is delivered is not a verdict.
  const settled = isSettled(entry.settlesAt);
  const until = settled ? (entry.settlesAt ?? null) : null;
  const openDays = daysSince(entry.statedAt) ?? 0;
  const days = settled
    ? Math.round(
        (Date.parse(entry.settlesAt + "T00:00:00Z") - Date.parse(entry.statedAt + "T00:00:00Z")) /
          86_400_000
      )
    : openDays;
  const left = daysUntil(entry.settlesAt);
  const months = entry.settlesAt ? monthsBetween(entry.statedAt, entry.settlesAt) : 0;

  const [quotes, track] = await Promise.all([
    getQuotes(book.holdings.map((h) => h.t)),
    trackBook(book, entry.statedAt, days, until),
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

      {settled ? (
        <p className={"notice rv " + (ahead ? "" : "warn")} style={{ marginTop: 18 }}>
          {/* The whole point of a horizon: on this date the claim stops being
              a work in progress and becomes something that was right or wrong. */}
          <b>Settled on {human(entry.settlesAt!)}.</b> Over {horizonLabel(months)}, this book
          returned <b>{track.bookEnd >= 0 ? "+" : ""}{track.bookEnd.toFixed(1)}%</b> against the
          index&rsquo;s <b>{track.indexEnd >= 0 ? "+" : ""}{track.indexEnd.toFixed(1)}%</b> — the
          claim {ahead ? "held" : "failed"}. The figure does not move again.
          {track.live
            ? ""
            : " It is drawn from the premise rather than from market data, and is worth nothing until real prices are switched on."}
        </p>
      ) : entry.settlesAt ? (
        <p className="notice rv" style={{ marginTop: 18 }}>
          Judged on <b>{human(entry.settlesAt)}</b>
          {left !== null ? `, ${left} day${left === 1 ? "" : "s"} from now` : ""}. On that date the
          record states what happened over {horizonLabel(months)} and stops. Until then this is an
          open claim, not a result.{" "}
          <a href={icsHref(entry.id)}>Add the date to a calendar</a> — the file is made on request
          and nothing about you is stored.
        </p>
      ) : (
        <p className="notice warn rv" style={{ marginTop: 18 }}>
          This claim was recorded before horizons existed, so it has no settlement date and can
          never be judged — only watched. That is the gap the field was added to close; the entry
          is left as it was made rather than backdated into something it never said.
        </p>
      )}

      <p className="notice rv" style={{ marginTop: 14 }}>
        Stated on <b>{human(entry.statedAt)}</b>, {openDays === 0 ? "today" : `${openDays} days ago`}
        , and measured ever since. That date was written by the server when this claim was committed. It
        is not in the link and cannot be changed — which is what makes the figure below worth
        anything.
        {entry.weights || entry.drop?.length
          ? " These are the author's own weights, not the generator's defaults."
          : ""}
      </p>

      {track.live && !settled ? (
        <p className="notice rv" style={{ marginTop: 14 }}>
          Since then the book is <b>{track.bookEnd >= 0 ? "+" : ""}{track.bookEnd.toFixed(1)}%</b>{" "}
          and the index <b>{track.indexEnd >= 0 ? "+" : ""}{track.indexEnd.toFixed(1)}%</b> — the
          book is {ahead ? "ahead" : "behind"}.
          {track.missing.length
            ? ` ${track.missing.length} holding${track.missing.length > 1 ? "s" : ""} could not be
               priced (${track.missing.join(", ")}) and their weight was spread across the rest.`
            : ""}
        </p>
      ) : track.live ? null : (
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
        {/* The fork. Opening this book with its weights intact is the start of
            someone else's version: change the sizing, commit that, and both
            stand side by side on the record under the same belief. */}
        <Link
          className="b1"
          href={bookHref(entry.premise, entry.drop ?? [], {
            universe: entry.universe,
            weights: entry.weights || undefined,
          })}
        >
          Fork this book
        </Link>
        <Link className="b2" href="/ledger">
          Every claim on the record
        </Link>
      </div>
    </section>
  );
}
