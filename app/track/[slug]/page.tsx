import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NoMatch } from "@/components/NoMatch";
import { TrackChart, trackSeries } from "@/components/TrackChart";
import { buildBook } from "@/lib/generator";
import { slugOf } from "@/lib/hash";
import { normalizePremise } from "@/lib/premise";
import { bookHref, daysSince, ogHref, parseStated, parseUniverse, trackHref } from "@/lib/routes";
import { SYNTHETIC } from "@/lib/market";
import { HOST, SITE } from "@/lib/site";

type Params = { slug: string };
type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const premise = normalizePremise(sp.p);
  const days = daysSince(parseStated(sp.d));
  const b = buildBook(premise);

  if (!b.ok) {
    return {
      title: "No match for that premise",
      robots: { index: false, follow: true },
      alternates: { canonical: `/track/${slug}` },
    };
  }

  const { bEnd, sEnd, win } = trackSeries(b, days);
  const title = b.premise.length > 56 ? b.premise.slice(0, 55).trimEnd() + "…" : b.premise;
  const description = `Tracked against the index since the premise was stated: book ${
    bEnd >= 0 ? "+" : ""
  }${bEnd.toFixed(1)}%, index ${sEnd >= 0 ? "+" : ""}${sEnd.toFixed(1)}%. The book is ${
    win ? "ahead" : "behind"
  } — the benchmark is shown either way.`;

  return {
    title: `Track: ${title}`,
    description,
    alternates: { canonical: trackHref(b.premise) },
    openGraph: {
      url: trackHref(b.premise),
      title: `Track: ${title} — ${SITE.name}`,
      description,
      images: [{ url: ogHref(b.premise), width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [ogHref(b.premise)] },
    // Every figure on this page is synthetic. Publishing fabricated performance
    // into a search index would be the one dishonest thing on an otherwise
    // honest site — and performance claims are exactly what regulators read.
    // Drop this (and restore the sitemap entries) when real data lands.
    robots: { index: false, follow: true },
  };
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const premise = normalizePremise(sp.p);
  const stated = parseStated(sp.d);
  const universe = parseUniverse(sp.u);
  const days = daysSince(stated);
  const book = buildBook(premise);
  if (!book.ok) return <NoMatch premise={premise} emptied={book.emptied} />;

  const b = book;
  if (slug !== slugOf(b.premise)) {
    redirect(trackHref(b.premise, { stated: stated ?? undefined, universe: universe ?? undefined }));
  }
  const { bEnd, sEnd, win, N } = trackSeries(b, days);

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Track</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
        Measured against the index, from the day it was stated.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        A thesis that cannot beat buying the whole market is a thesis that cost you money to hold.
        This one {win ? "is ahead" : "is behind"} — the benchmark is shown either way.
      </p>
      <div className="window rv" style={{ marginTop: "clamp(26px,3.5vw,44px)" }}>
        <div className="wbar">
          <div className="wdots">
            <i />
            <i />
            <i />
          </div>
          <div className="wurl">
            {HOST}/track/{slugOf(b.premise)}
          </div>
        </div>
        <div className="wbody">
          <p
            style={{
              fontSize: "clamp(15px,1.7vw,19px)",
              color: "var(--fg-2)",
              maxWidth: "44ch",
              fontWeight: 400,
            }}
          >
            {b.premise}
          </p>
          <TrackChart book={b} days={days} />
        </div>
      </div>
      <div className="stats rv" style={{ marginTop: 12 }}>
        <div>
          <div className="sn">
            {bEnd >= 0 ? "+" : ""}
            {bEnd.toFixed(1)}%
          </div>
          <div className="sl">Book, since stated</div>
        </div>
        <div>
          <div className="sn mut">
            {sEnd >= 0 ? "+" : ""}
            {sEnd.toFixed(1)}%
          </div>
          <div className="sl">Index, same window</div>
        </div>
        <div>
          <div className={"sn " + (win ? "ac" : "wn")}>
            {bEnd - sEnd >= 0 ? "+" : ""}
            {(bEnd - sEnd).toFixed(1)}%
          </div>
          <div className="sl">{win ? "Ahead of" : "Behind"} the index</div>
        </div>
        <div>
          <div className="sn">{b.holdings.length}</div>
          <div className="sl">Holdings, unchanged</div>
        </div>
      </div>
      <p className="notice rv" style={{ marginTop: 26 }}>
        Weights are frozen at the moment the premise was stated. Nothing has been rebalanced, so
        this measures the claim rather than the trading around it.{" "}
        {stated ? (
          <>
            This claim was stated on {stated}, {days} day{days === 1 ? "" : "s"} ago, which is the{" "}
            {N} sessions charted above.
          </>
        ) : (
          <>
            This link carries no stated date, so the window is a default {N} sessions rather than a
            real one. Books composed from now on carry their date.
          </>
        )}
      </p>
      {SYNTHETIC ? (
        <p className="notice warn rv" style={{ marginTop: 14 }}>
          Prototype figures. The return series is synthetic, drawn from the premise itself and
          centred on the index — so roughly half of all books lose. Try several premises and you
          will find losers. Replace with a real return series before this page is shown to anyone.
        </p>
      ) : null}
      <div
        className="hero-cta rv"
        style={{ justifyContent: "flex-start", marginTop: "clamp(28px,4vw,44px)" }}
      >
        <Link className="b1" href="/compose">
          Compose a book
        </Link>
        <Link className="b2" href={bookHref(b.premise)}>
          Open the full book
        </Link>
      </div>
    </section>
  );
}
