import type { Metadata } from "next";

import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";
import Link from "next/link";

import { FilterList } from "@/components/FilterList";
import { nameHref } from "@/lib/names";
import { bookHref } from "@/lib/routes";
import { fmtMcap, fmtPrice, getQuotes } from "@/lib/market";
import { NAMES, REVIEWED, THEMES, UNIVERSE_VERSION } from "@/lib/universe";

/**
 * Market figures on this page are fetched on the server, and the vendor key is
 * set at runtime rather than at build time. Without this the page would be
 * baked once — during a build that had no key — and would go on serving
 * synthetic numbers for ever, however the server was later configured.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "The universe",
  description: `Every name a Igitur book can hold — ${NAMES} across ${THEMES.length} themes — published with the reason it can earn weight and the conviction score that sets its size.`,
  alternates: { canonical: "/universe" },
  openGraph: {
    url: "/universe",
    title: `The universe — ${SITE.name}`,
    description: `All ${NAMES} names across ${THEMES.length} themes, with a written reason and a conviction score on every one.`,
    images: [{ url: pageOg("universe"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [pageOg("universe")] },
};

export default async function UniversePage() {
  const quotes = await getQuotes(THEMES.flatMap((t) => t.assets.map((a) => a.t)));
  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">The universe</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "16ch" }}>
        Published in the open.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        A curated universe, not a search of every listed security. Every name a book can hold is on
        this page with the reason it can earn weight and the conviction score that sets its size. If
        it is not here, no premise will produce it.
      </p>
      <div className="stats rv" style={{ marginTop: "clamp(26px,3.5vw,44px)" }}>
        <div>
          <div className="sn">{NAMES}</div>
          <div className="sl">names</div>
        </div>
        <div>
          <div className="sn">{THEMES.length}</div>
          <div className="sl">themes</div>
        </div>
        <div>
          <div className="sn">3</div>
          <div className="sl">ballast instruments</div>
        </div>
        <div>
          <div className="sn" style={{ fontSize: 18, letterSpacing: "-.02em", paddingTop: 7 }}>
            {REVIEWED}
          </div>
          <div className="sl">last reviewed</div>
        </div>
      </div>

      <FilterList placeholder="Filter by ticker, company or theme" label="Filter universe">
        <div id="ulist">
          {THEMES.map((th) => (
            <div
              key={th.id}
              className="rv ublock"
              data-find={`${th.name} ${th.claim} ${th.assets
                .map((a) => `${a.t} ${a.n}`)
                .join(" ")}`.toLowerCase()}
              style={{ marginTop: "clamp(26px,3.5vw,46px)" }}
            >
              <div className="bento" style={{ gridTemplateColumns: "repeat(6,1fr)", marginTop: 0 }}>
                <div className="cell c2" style={{ alignSelf: "start" }}>
                  <h3>{th.name}</h3>
                  <p className="p" style={{ fontSize: 13, marginTop: 8 }}>
                    {th.claim}
                  </p>
                  <div className="meta" style={{ marginTop: 14 }}>
                    <span className="tagp">{th.risk}</span>
                    <span className="tagp">{th.horizon}</span>
                  </div>
                  <Link className="b2" href={bookHref(th.claim, [], { universe: UNIVERSE_VERSION })} style={{ marginTop: 14 }}>
                    Build this book
                  </Link>
                </div>
                <div className="cell c4" style={{ padding: 14 }}>
                  {th.assets.map((a) => (
                    <div key={a.t} className="hrow" style={{ ["--fw" as string]: `${a.c}%` }}>
                      <span className="hw" style={{ fontSize: 13 }}>
                        <Link href={nameHref(a.t)} className="tlink">
                          {a.t}
                        </Link>
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="hn">{a.n}</span>
                        <div className="hy">{a.why}</div>
                        <div className="hm">
                          {a.k} · {fmtPrice(quotes.get(a.t)?.price ?? 0)} ·{" "}
                          {fmtMcap(quotes.get(a.t)?.marketCap ?? 0)} · conviction {a.c}/100
                        </div>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="faint" data-empty style={{ display: "none", padding: "26px 0", fontSize: 14 }}>
          No theme or holding matches that filter.
        </p>
      </FilterList>
    </section>
  );
}
