import type { Metadata } from "next";

import { pageOg } from "@/lib/og-pages";
import Link from "next/link";

import { FilterList } from "@/components/FilterList";
import { nameHref } from "@/lib/names";
import { fmtPrice, getQuotes, isLive, sparkPath } from "@/lib/market";
import { HOST, SITE } from "@/lib/site";
import { UNIVERSE } from "@/lib/universe";

export const metadata: Metadata = {
  title: "Trending",
  description:
    "Every name in the Igitur universe ranked by how far it moved, so a fall ranks alongside a rise of the same size. Nothing on the page is chosen.",
  alternates: { canonical: "/trending" },
  openGraph: {
    url: "/trending",
    title: `Trending — ${SITE.name}`,
    description:
      "Every name in the universe ranked by absolute move. The order is a measurement, not a recommendation.",
    images: [{ url: pageOg("trending"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [pageOg("trending")] },
};


export default async function TrendingPage() {
  // One request for the whole universe, not one per row.
  const quotes = await getQuotes(UNIVERSE.map((a) => a.t));
  const live = isLive();
  const rows = UNIVERSE.map((a) => {
    const q = quotes.get(a.t)!;
    return { ...a, q, m: q.changePct };
  }).sort((x, y) => Math.abs(y.m) - Math.abs(x.m));

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Trending</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "16ch" }}>
        Ranked by how far it moved.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        Nothing on this page is chosen. The order is a measurement, so a fall ranks alongside a rise
        of the same size. A name near the top is not a name worth owning.
      </p>

      <FilterList
        placeholder={`Filter ${rows.length} names by ticker, name or theme`}
        label="Filter names"
        wrapStyle={{ marginTop: "clamp(24px,3vw,36px)", maxWidth: 420 }}
      >
        <div className="window rv" style={{ marginTop: 16 }}>
          <div className="wbar">
            <div className="wdots">
              <i />
              <i />
              <i />
            </div>
            <div className="wurl">{HOST}/trending</div>
          </div>
          <div className="wbody" style={{ padding: "16px 12px 14px" }}>
            <div className="thead">
              <span>#</span>
              <span>Ticker</span>
              <span>Name</span>
              <span>Price</span>
              <span>Session</span>
              <span>Move</span>
            </div>
            <div id="trows">
              {rows.map((a, i) => {
                const stroke = a.m >= 0 ? "#fff" : "#AEB6FF";
                const body = (
                  <>
                    <span className="tr">{i + 1}</span>
                    <span className="tt">{a.t}</span>
                    <span className="tn">{a.n}</span>
                    <span className="tpx">{fmtPrice(a.q.price)}</span>
                    <svg className="tsp" viewBox="0 0 112 26" preserveAspectRatio="none" aria-hidden="true">
                      <path
                        d={sparkPath(a.q, 112, 26)}
                        fill="none"
                        stroke={stroke}
                        strokeWidth="1.5"
                        opacity=".8"
                      />
                    </svg>
                    <span className={"tm " + (a.m >= 0 ? "up" : "down")}>
                      {a.m >= 0 ? "+" : ""}
                      {a.m.toFixed(2)}%
                    </span>
                  </>
                );
                const find = `${a.t} ${a.n} ${a.theme}`.toLowerCase();
                // Clicking a ticker asks about the name, not about a theme.
                return (
                  <Link key={a.t} className="trow" href={nameHref(a.t)} data-find={find}>
                    {body}
                  </Link>
                );
              })}
            </div>
            <p className="faint" data-empty style={{ display: "none", padding: "22px 4px", fontSize: 13 }}>
              No name matches that filter.
            </p>
          </div>
        </div>
      </FilterList>

      {!live ? (
        <p className="notice warn rv" style={{ marginTop: 18 }}>
          Prototype figures. Prices, moves and sparklines are generated deterministically from the
          ticker text — they are not live quotes and must be replaced with a market data feed before
          this page is shown to anyone.
        </p>
      ) : null}
    </section>
  );
}
