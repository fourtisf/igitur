import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Bar, BarFoot } from "@/components/Bar";
import { ShareBook } from "@/components/ShareBook";
import { Holdings } from "@/components/Holdings";
import { NoMatch } from "@/components/NoMatch";
import { Remember } from "@/components/Remember";
import { buildBook } from "@/lib/generator";
import { slugOf } from "@/lib/hash";
import { normalizePremise } from "@/lib/premise";
import { bookHref, ogHref, parseDrop, trackHref } from "@/lib/routes";
import { HOST, SITE } from "@/lib/site";

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
  return { premise, drop, book: buildBook(premise, drop) };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { drop, book } = read(await searchParams);

  // A refusal is a real page, but it is not one to index.
  if (!book.ok) {
    return {
      title: "No match for that premise",
      description:
        "No theme in this universe carries that claim. Premise stops rather than assembling a plausible-looking portfolio out of whatever was nearest.",
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
  const canonical = bookHref(book.premise, drop);
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
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${SITE.name}`,
      description,
      images: [image],
    },
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
  const { premise, drop, book } = read(sp);

  if (!book.ok) return <NoMatch premise={premise} emptied={book.emptied} />;

  // The slug is readable text, not an identifier — the premise in the query
  // string is what builds the book. Left unchecked, that lets a shared link
  // carry a slug that contradicts the premise it renders
  // (/b/nuclear-is-dead?p=nuclear+will+boom). Send any mismatch to the one
  // canonical address so the URL a person reads always matches the page.
  if (slug !== slugOf(book.premise)) redirect(bookHref(book.premise, drop));

  const b = book;
  const short = `${HOST}/b/${slugOf(b.premise)}`;
  const low = b.confidence < 50;

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
      </div>

      {/* The honest signal that the match is weak. HANDOFF.md §3.2 — keep it. */}
      {low ? (
        <p className="notice warn rv" style={{ marginTop: 18 }}>
          Only {b.hits.length} term{b.hits.length === 1 ? "" : "s"} in your premise matched this
          theme{b.hits.length ? ` (${b.hits.join(", ")})` : ""}. The match is weak — check the
          holdings carefully or rewrite the premise more specifically.
        </p>
      ) : null}

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
            {drop.length ? (
              <Link className="b3" href={bookHref(b.premise)}>
                Restore removed
              </Link>
            ) : (
              <span className="faint" style={{ fontSize: 12 }}>
                Click × to remove and reweight
              </span>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <Holdings
              holdings={b.holdings}
              removeHref={(t) => bookHref(b.premise, drop.includes(t) ? drop : [...drop, t])}
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
          <div className="cell" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14 }}>This book has an address</h3>
            <p className="p" style={{ fontSize: 12.5, marginTop: 6 }}>
              Anyone who opens it rebuilds the same book, weight for weight.
            </p>
            <ShareBook display={short} premise={b.premise} />
            <Link
              className="b2"
              style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
              href={trackHref(b.premise)}
            >
              Track this book
            </Link>
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
