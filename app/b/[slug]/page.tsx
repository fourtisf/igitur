import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { twitterCard } from "@/lib/twitter-card";

import { Bar, BarFoot } from "@/components/Bar";
import { CommitPremise } from "@/components/CommitPremise";
import { ShareBook } from "@/components/ShareBook";
import { Holdings } from "@/components/Holdings";
import { NoMatch } from "@/components/NoMatch";
import { Amount } from "@/components/Amount";
import { Remember } from "@/components/Remember";
import { buildBook } from "@/lib/generator";
import { applyPins, formatPins, MAX_PCT, MIN_PCT, parsePins } from "@/lib/reweight";
import { slugOf } from "@/lib/hash";
import { normalizePremise } from "@/lib/premise";
import {
  bookCanonical,
  bookHref,
  daysSince,
  ogHref,
  parseDrop,
  parseStated,
  parseUniverse,
  trackHref,
} from "@/lib/routes";
import { getQuotes } from "@/lib/market";
import { HOST, SITE } from "@/lib/site";
import { THEME_BY_ID, UNIVERSE_VERSION } from "@/lib/universe";

type Params = { slug: string };
type Search = Record<string, string | string[] | undefined>;

/**
 * The book page. Server-rendered so a shared link is crawlable — HANDOFF.md §6.1.
 *
 * The premise travels in `?p=`, so the book is rebuilt from the URL alone with
 * no database behind it. The slug carries readable words for the crawler and
 * the reader; it is not needed to reconstruct the book.
 */

function read(sp: Search) {
  const premise = normalizePremise(sp.p);
  const drop = parseDrop(sp.x);
  return {
    premise,
    drop,
    // Provenance, not content: neither changes what the book holds.
    universe: parseUniverse(sp.u),
    stated: parseStated(sp.d),
    ...(() => {
      const generated = buildBook(premise, drop);
      if (!generated.ok) return { pins: new Map<string, number>(), book: generated };
      const known = new Set(generated.holdings.filter((h) => !h.ballast).map((h) => h.t));
      const pins = parsePins(sp.w, known);
      return { pins, book: applyPins(generated, pins) };
    })(),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { drop, pins, book } = read(await searchParams);

  // A refusal is a real page, but it is not one to index.
  if (!book.ok) {
    return {
      title: "No match for that premise",
      description:
        "No theme in this universe carries that claim. Igitur stops rather than assembling a plausible-looking portfolio out of whatever was nearest.",
      robots: { index: false, follow: true },
      alternates: { canonical: `/b/${slug}` },
    };
  }

  const title = book.premise.length > 66 ? book.premise.slice(0, 65).trimEnd() + "…" : book.premise;
  const description =
    `${book.theme.name} · ${book.risk} · ${book.horizon} · ${book.holdings.length} holdings. ` +
    `Led by ${book.holdings[0].n} at ${book.holdings[0].pct}%. Every weight carries the reason it earned its size.`;

  // A distinct canonical per book — never the homepage. This is the exact bug
  // the competitor shipped, and §6.1 says not to repeat it.
  const canonical = bookCanonical(book.premise, drop, formatPins(pins) || undefined);
  const image = ogHref(book.premise, drop);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: `${title} — ${SITE.name}`,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: `Allocation for: ${book.premise}` }],
    },
    twitter: { ...twitterCard(image), title: `${title} — ${SITE.name}`, description },
  };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { premise, drop, universe, stated, pins, book } = read(sp);

  if (!book.ok) return <NoMatch premise={premise} emptied={book.emptied} />;

  const prov = { universe: universe ?? undefined, stated: stated ?? undefined };
  const quotes = await getQuotes(book.holdings.map((h) => h.t));

  // The slug is readable text, not an identifier — the premise in the query
  // string is what builds the book. Left unchecked, that lets a shared link
  // carry a slug that contradicts the premise it renders
  // (/b/nuclear-is-dead?p=nuclear+will+boom). Send any mismatch to the one
  // canonical address so the URL a person reads always matches the page.
  if (slug !== slugOf(book.premise)) {
    redirect(bookHref(book.premise, drop, { ...prov, weights: formatPins(pins) || undefined }));
  }

  const b = book;
  const short = `${HOST}/b/${slugOf(b.premise)}`;
  const low = b.confidence < 50;
  // A book is deterministic for a given universe, not absolutely. Say so when
  // the link was built against an older one, rather than quietly serving
  // different holdings than the sender saw.
  const stale = universe !== null && universe !== UNIVERSE_VERSION;
  const age = daysSince(stated);

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <Remember premise={b.premise} />
      <span className="kick rv">Your book</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "26ch", fontWeight: 550 }}>
        {b.premise}
      </h1>
      <div className="meta rv" style={{ marginTop: 20 }}>
        <span className="tagp on">{b.theme.name}</span>
        {b.second ? <span className="tagp">+ {b.second.name}</span> : null}
        <span className="tagp">{b.risk}</span>
        <span className="tagp">{b.horizon}</span>
        <span className="tagp">{b.holdings.length} holdings</span>
        <span className={"tagp" + (low ? " warn" : "")}>Confidence {b.confidence}%</span>
        {drop.length ? <span className="tagp warn">{drop.length} removed</span> : null}
        {pins.size ? <span className="tagp warn">{pins.size} reweighted</span> : null}
      </div>

      {/* The honest signal that the match is weak. HANDOFF.md §3.2 — keep it. */}
      {low ? (
        <p className="notice warn rv" style={{ marginTop: 18 }}>
          Only {b.hits.length} term{b.hits.length === 1 ? "" : "s"} in your premise matched this
          theme{b.hits.length ? ` (${b.hits.join(", ")})` : ""}. The match is weak — check the
          holdings carefully or rewrite the premise more specifically.
        </p>
      ) : null}

      {stale ? (
        <p className="notice warn rv" style={{ marginTop: 18 }}>
          This link was built against universe v{universe}, and the published universe is now v
          {UNIVERSE_VERSION}. Conviction scores and holdings may have been revised since, so the
          book below is not necessarily the one that was shared.{" "}
          <Link href="/changes" style={{ textDecoration: "underline" }}>
            See what changed
          </Link>
          .
        </p>
      ) : null}

      <div className="prov rv">
        <span>
          Universe v{universe ?? UNIVERSE_VERSION}
          {universe === null ? " (assumed — this link predates the field)" : ""}
        </span>
        {stated ? (
          <span>
            · Stated {stated}
            {age !== null && age > 0 ? `, ${age} day${age === 1 ? "" : "s"} ago` : ", today"}
          </span>
        ) : (
          <span>· No stated date on this link</span>
        )}
      </div>

      <div className="window rv" style={{ marginTop: "clamp(26px,3.5vw,44px)" }}>
        <div className="wbar">
          <div className="wdots">
            <i />
            <i />
            <i />
          </div>
          <div className="wurl">{short}</div>
        </div>
        <div className="wbody">
          <Bar holdings={b.holdings} animate />
          <BarFoot />
        </div>
      </div>

      <div className="bento rv" style={{ marginTop: 12 }}>
        <div className="cell c4">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <h3>Every holding, and why it is that size</h3>
            {drop.length || pins.size ? (
              <Link className="b3" href={bookHref(b.premise, [], prov)}>
                Restore the book
              </Link>
            ) : (
              <span className="faint" style={{ fontSize: 12 }}>
                Nudge a weight with ± , or × to remove
              </span>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <Holdings
              holdings={b.holdings}
              quotes={quotes}
              removeHref={(t) => {
                const next = new Map(pins);
                next.delete(t);
                return bookHref(b.premise, drop.includes(t) ? drop : [...drop, t], {
                  ...prov,
                  weights: formatPins(next) || undefined,
                });
              }}
              stepHref={(t, delta) => {
                const cur = b.holdings.find((h) => h.t === t);
                if (!cur) return null;
                const want = Math.round((cur.pct + delta) * 10) / 10;
                if (want < MIN_PCT || want > MAX_PCT) return null;
                const next = new Map(pins);
                next.set(t, want);
                return bookHref(b.premise, drop, { ...prov, weights: formatPins(next) });
              }}
            />
          </div>
        </div>
        <div className="c2" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="cell" style={{ padding: 20 }}>
            <div
              className="sbox sfor"
              style={{ background: "none", boxShadow: "none", padding: "10px 0 0" }}
            >
              <div className="slab">The case for</div>
              <div className="stx">{b.theme.forCase}</div>
            </div>
          </div>
          <div className="cell" style={{ padding: 20 }}>
            <div
              className="sbox sag"
              style={{ background: "none", boxShadow: "none", padding: "10px 0 0" }}
            >
              <div className="slab">The case against</div>
              <div className="stx">{b.theme.againstCase}</div>
            </div>
          </div>
          {b.alternatives.length ? (
            <div className="cell" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14 }}>Also considered</h3>
              <p className="p" style={{ fontSize: 12.5, marginTop: 6 }}>
                These themes scored on your premise but did not lead. The matcher weighs all{" "}
                {THEME_BY_ID.size} and reports what it rejected.
              </p>
              <div className="alts">
                {b.alternatives.map((a) => {
                  const th = THEME_BY_ID.get(a.id);
                  return th ? (
                    <Link key={a.id} href={bookHref(th.claim, [], { universe: UNIVERSE_VERSION })}>
                      {a.name} <i>{a.score}</i>
                    </Link>
                  ) : null;
                })}
              </div>
            </div>
          ) : null}

          <div className="cell" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14 }}>What the weights are worth</h3>
            <p className="p" style={{ fontSize: 12.5, marginTop: 6 }}>
              Percentages, converted. Nothing is sent anywhere.
            </p>
            <Amount holdings={b.holdings} />
          </div>

          <div className="cell" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14 }}>This book has an address</h3>
            <p className="p" style={{ fontSize: 12.5, marginTop: 6 }}>
              Anyone who opens it rebuilds the same book, weight for weight.
            </p>
            <ShareBook display={short} premise={b.premise} />
            <a
              className="b2"
              style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
              href={`/api/book.csv?${new URLSearchParams({
                p: b.premise,
                ...(drop.length ? { x: drop.join(",") } : {}),
                ...(pins.size ? { w: formatPins(pins) } : {}),
                u: String(universe ?? UNIVERSE_VERSION),
                ...(stated ? { d: stated } : {}),
              })}`}
              download
            >
              Download as CSV
            </a>
            <Link
              className="b2"
              style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
              href={trackHref(b.premise, prov)}
            >
              Track this book
            </Link>
          </div>

          {/* A shared link proves nothing about when it was written — the date
              in it is whatever the sender typed. This is the one way to fix a
              claim to a date the reader can trust, because the server writes
              it and nobody can edit it afterwards. */}
          <div className="cell" style={{ padding: 16, marginTop: 12 }}>
            <h3 style={{ fontSize: 14 }}>Or fix it to a date</h3>
            <p className="p" style={{ fontSize: 12.5, marginTop: 6 }}>
              Put the claim on the public record and it is measured from the day the server saw
              it — win or lose, permanently.
            </p>
            <div style={{ marginTop: 10 }}>
              <CommitPremise premise={b.premise} />
            </div>
          </div>
        </div>
      </div>

      <div
        className="hero-cta rv"
        style={{ justifyContent: "flex-start", marginTop: "clamp(30px,4vw,50px)" }}
      >
        <Link className="b1" href="/compose">
          Compose another
        </Link>
        <Link className="b2" href="/method">
          How the weights were set
        </Link>
      </div>
    </section>
  );
}
