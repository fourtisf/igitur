import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { fmtMcap, mcapOf, moveFor, priceOf, sparkPath, SYNTHETIC } from "@/lib/market";
import { lookupName, nameHref, NAMES_INDEX } from "@/lib/names";
import { pageOg } from "@/lib/og-pages";
import { bookHref } from "@/lib/routes";
import { SITE } from "@/lib/site";
import { THEMES, UNIVERSE_VERSION } from "@/lib/universe";

/**
 * A page per name. HANDOFF.md has no line for this, but the data has been
 * sitting there since the prototype: every one of the 170 asset entries carries
 * a written reason and a conviction score, and none of it had a URL. Clicking a
 * ticker on /trending went to a theme's book rather than to the name.
 *
 * These are static: the content is the universe, which only changes when the
 * universe version does.
 */

type Params = { ticker: string };

export function generateStaticParams(): Params[] {
  return NAMES_INDEX.map((n) => ({ ticker: n.ticker.toLowerCase() }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const n = lookupName(ticker);
  if (!n) return { title: "Not found", robots: { index: false, follow: true } };

  const lead = n.positions[0];
  const description = lead
    ? `${n.name} (${n.ticker}) can earn weight in ${n.positions.length} of Igitur's ${THEMES.length} themes. ` +
      `Highest conviction ${lead.conviction}/100 in ${lead.themeName}: ${lead.why}`
    : `${n.name} (${n.ticker}) is a ballast instrument in Igitur. ${n.ballastWhy ?? ""}`;

  return {
    title: `${n.ticker} — ${n.name}`,
    description,
    alternates: { canonical: nameHref(n.ticker) },
    openGraph: {
      url: nameHref(n.ticker),
      title: `${n.ticker} — ${n.name} — ${SITE.name}`,
      description,
      images: [{ url: pageOg("universe"), width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [pageOg("universe")] },
  };
}

export default async function NamePage({ params }: { params: Promise<Params> }) {
  const { ticker } = await params;
  const n = lookupName(ticker);
  if (!n) notFound();

  const move = moveFor(n.ticker);
  const price = priceOf(n.ticker);
  const best = n.positions[0];

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">
        <Link href="/universe">The universe</Link> · {n.kind}
      </span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
        {n.name}
      </h1>
      <div className="meta rv" style={{ marginTop: 20 }}>
        <span className="tagp on">{n.ticker}</span>
        <span className="tagp">{n.kind}</span>
        {n.ballast ? <span className="tagp">Ballast</span> : null}
        <span className="tagp">
          {n.positions.length ? `${n.positions.length} theme${n.positions.length === 1 ? "" : "s"}` : "No theme"}
        </span>
      </div>

      <div className="stats rv" style={{ marginTop: "clamp(26px,3.5vw,44px)" }}>
        <div>
          <div className="sn">${price.toFixed(2)}</div>
          <div className="sl">last price</div>
        </div>
        <div>
          <div className={"sn " + (move >= 0 ? "" : "ac")}>
            {move >= 0 ? "+" : ""}
            {move.toFixed(2)}%
          </div>
          <div className="sl">session</div>
        </div>
        <div>
          <div className="sn">{fmtMcap(mcapOf(n.ticker))}</div>
          <div className="sl">market cap</div>
        </div>
        <div>
          <div className="sn">{best ? `${best.conviction}` : "—"}</div>
          <div className="sl">{best ? "highest conviction" : "conviction"}</div>
        </div>
      </div>

      <div className="window rv" style={{ marginTop: 12 }}>
        <div className="wbar">
          <div className="wdots">
            <i />
            <i />
            <i />
          </div>
          <div className="wurl">
            {SITE.url.replace(/^https?:\/\//, "")}
            {nameHref(n.ticker)}
          </div>
        </div>
        <div className="wbody">
          <svg
            viewBox="0 0 640 90"
            preserveAspectRatio="none"
            style={{ width: "100%", height: 90 }}
            role="img"
            aria-label={`${n.ticker} session chart, ${move.toFixed(2)} percent`}
          >
            <path
              d={sparkPath(n.ticker, 640, 90)}
              fill="none"
              stroke={move >= 0 ? "#FAFAFA" : "#AEB6FF"}
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

      {n.positions.length ? (
        <>
          <h2 className="rv" style={{ marginTop: "clamp(44px,5vw,72px)", maxWidth: "24ch" }}>
            {n.positions.length === 1
              ? "Where it earns weight."
              : "It earns weight in more than one thesis — for different reasons."}
          </h2>
          <p className="sub rv" style={{ marginTop: 14 }}>
            Conviction answers one question: if the claim turns out to be true, how directly does
            this name benefit? The score sets the size, and the formula is published.
          </p>
          <div className="bento rv" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
            {n.positions.map((p) => (
              <div className="cell c3" key={p.themeId}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 12,
                  }}
                >
                  <h3>{p.themeName}</h3>
                  <span className="sn" style={{ fontSize: 22 }}>
                    {p.conviction}
                    <span className="faint" style={{ fontSize: 12, fontWeight: 400 }}>
                      /100
                    </span>
                  </span>
                </div>
                <div className="hrow" style={{ ["--fw" as string]: `${p.conviction}%`, marginTop: 12 }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="hn">{p.why}</span>
                  </span>
                </div>
                <p className="p" style={{ fontSize: 13, marginTop: 12 }}>
                  {p.claim}
                </p>
                <div className="meta" style={{ marginTop: 12 }}>
                  <span className="tagp">{p.risk}</span>
                  <span className="tagp">{p.horizon}</span>
                </div>
                <Link
                  className="b2"
                  style={{ marginTop: 14 }}
                  href={bookHref(p.claim, [], { universe: UNIVERSE_VERSION })}
                >
                  Build this book
                </Link>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="cell rv" style={{ marginTop: 12, padding: "clamp(20px,2.6vw,28px)" }}>
          <h3>Ballast</h3>
          <p className="p" style={{ marginTop: 8, maxWidth: "56ch" }}>
            {n.ballastWhy}
          </p>
          <p className="p" style={{ marginTop: 10, maxWidth: "56ch" }}>
            No theme selects this name. It is appended to every book by risk level — 6% speculative,
            10% aggressive, 16% moderate, 22% conservative — so a book is never entirely inside its
            own thesis.
          </p>
        </div>
      )}

      {SYNTHETIC ? (
        <p className="notice warn rv" style={{ marginTop: 22 }}>
          Prototype figures. The price, session move, market cap and chart above are generated
          deterministically from the ticker text. They are not live quotes. The conviction scores
          and written reasons are real editorial judgements, described on the methodology page.
        </p>
      ) : null}

      <div
        className="hero-cta rv"
        style={{ justifyContent: "flex-start", marginTop: "clamp(30px,4vw,50px)" }}
      >
        <Link className="b1" href="/compose">
          Compose a book
        </Link>
        <Link className="b2" href="/universe">
          Every name
        </Link>
      </div>
    </section>
  );
}
