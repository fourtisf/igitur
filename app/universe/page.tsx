import type { Metadata } from "next";

import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";
import Link from "next/link";

import { FilterList } from "@/components/FilterList";
import { bookHref } from "@/lib/routes";
import { fmtMcap, mcapOf, priceOf } from "@/lib/market";
import { NAMES, REVIEWED, THEMES } from "@/lib/universe";

export const metadata: Metadata = {
  title: "The universe",
  description: `Every name a Priori book can hold — ${NAMES} across ${THEMES.length} themes — published with the reason it can earn weight and the conviction score that sets its size.`,
  alternates: { canonical: "/universe" },
  openGraph: {
    url: "/universe",
    title: `The universe — ${SITE.name}`,
    description: `All ${NAMES} names across ${THEMES.length} themes, with a written reason and a conviction score on every one.`,
    images: [{ url: pageOg("universe"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [pageOg("universe")] },
};

export default function UniversePage() {
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
                  <Link className="b2" href={bookHref(th.claim)} style={{ marginTop: 14 }}>
                    Build this book
                  </Link>
                </div>
                <div className="cell c4" style={{ padding: 14 }}>
                  {th.assets.map((a) => (
                    <div key={a.t} className="hrow" style={{ ["--fw" as string]: `${a.c}%` }}>
                      <span className="hw" style={{ fontSize: 13 }}>
                        {a.t}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="hn">{a.n}</span>
                        <div className="hy">{a.why}</div>
                        <div className="hm">
                          {a.k} · ${priceOf(a.t).toFixed(2)} · {fmtMcap(mcapOf(a.t))} · conviction{" "}
                          {a.c}/100
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
