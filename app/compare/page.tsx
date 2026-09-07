import type { Metadata } from "next";
import Link from "next/link";

import { Bar, BarFoot } from "@/components/Bar";
import { buildBook } from "@/lib/generator";
import { nameHref } from "@/lib/names";
import { pageOg } from "@/lib/og-pages";
import { normalizePremise } from "@/lib/premise";
import { bookHref } from "@/lib/routes";
import { SITE } from "@/lib/site";
import { UNIVERSE_VERSION } from "@/lib/universe";
import { CompareForm } from "./CompareForm";

export const metadata: Metadata = {
  title: "Compare two premises",
  description:
    "State two beliefs and see where the portfolios they imply agree and where they part. Beliefs have consequences; this shows the size of the difference.",
  alternates: { canonical: "/compare" },
  openGraph: {
    url: "/compare",
    title: `Compare two premises — ${SITE.name}`,
    description: "Where two beliefs agree, and where they part.",
    images: [{ url: pageOg("compose"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [pageOg("compose")] },
};

/**
 * Two premises, side by side.
 *
 * The intellectual core of the product is that beliefs have consequences. This
 * is the only page that shows the size of a disagreement: state "compute is the
 * constraint" against "energy is the constraint" and the overlap is the part
 * that does not depend on which of you is right.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const a = normalizePremise(sp.a);
  const b = normalizePremise(sp.b);
  const bookA = a ? buildBook(a) : null;
  const bookB = b ? buildBook(b) : null;

  const shared =
    bookA?.ok && bookB?.ok
      ? bookA.holdings.filter((h) => bookB.holdings.some((g) => g.t === h.t))
      : [];
  const onlyA =
    bookA?.ok && bookB?.ok
      ? bookA.holdings.filter((h) => !bookB.holdings.some((g) => g.t === h.t))
      : [];
  const onlyB =
    bookA?.ok && bookB?.ok
      ? bookB.holdings.filter((h) => !bookA.holdings.some((g) => g.t === h.t))
      : [];
  const overlapPct =
    bookA?.ok && bookB?.ok
      ? Math.round(
          shared.reduce((s, h) => {
            const other = bookB.holdings.find((g) => g.t === h.t);
            return s + Math.min(h.pct, other?.pct ?? 0);
          }, 0) * 10
        ) / 10
      : 0;

  const side = (label: string, premise: string, book: ReturnType<typeof buildBook> | null) => (
    <div className="cell c3">
      <span className="kick">{label}</span>
      {book?.ok ? (
        <>
          <h3 style={{ marginTop: 10 }}>{book.premise}</h3>
          <div className="meta" style={{ marginTop: 12 }}>
            <span className="tagp on">{book.theme.name}</span>
            <span className="tagp">{book.risk}</span>
            <span className={"tagp" + (book.confidence < 50 ? " warn" : "")}>
              {book.confidence}%
            </span>
          </div>
          <div style={{ marginTop: 14 }}>
            <Bar holdings={book.holdings} size="sm" />
          </div>
          <Link
            className="b2"
            style={{ marginTop: 14 }}
            href={bookHref(book.premise, [], { universe: UNIVERSE_VERSION })}
          >
            Open this book
          </Link>
        </>
      ) : premise ? (
        <>
          <h3 style={{ marginTop: 10 }}>{premise}</h3>
          <p className="p" style={{ marginTop: 10 }}>
            No theme in this universe carries that claim, so there is nothing to compare on this
            side. That refusal is deliberate.
          </p>
        </>
      ) : (
        <p className="p" style={{ marginTop: 10 }}>
          Nothing stated yet.
        </p>
      )}
    </div>
  );

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Compare</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
        Two beliefs, and the distance between them.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        State a claim and its rival. What both books hold is the part that does not depend on which
        of them is right — and what only one holds is what you are actually betting on.
      </p>

      <CompareForm a={a} b={b} />

      {bookA && bookB ? (
        <>
          <div className="bento rv" style={{ gridTemplateColumns: "repeat(6,1fr)", marginTop: 12 }}>
            {side("Premise A", a, bookA)}
            {side("Premise B", b, bookB)}
          </div>

          {bookA.ok && bookB.ok ? (
            <>
              <div className="stats rv" style={{ marginTop: 12 }}>
                <div>
                  <div className="sn">{overlapPct}%</div>
                  <div className="sl">held by both books</div>
                </div>
                <div>
                  <div className="sn">{shared.length}</div>
                  <div className="sl">names in common</div>
                </div>
                <div>
                  <div className="sn">{onlyA.length}</div>
                  <div className="sl">only in A</div>
                </div>
                <div>
                  <div className="sn">{onlyB.length}</div>
                  <div className="sl">only in B</div>
                </div>
              </div>

              <div className="bento rv" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
                <div className="cell c2">
                  <h3>Both hold</h3>
                  <p className="p" style={{ fontSize: 12.5, marginTop: 6 }}>
                    Not a bet on either claim.
                  </p>
                  <div style={{ marginTop: 12 }}>
                    {shared.length ? (
                      shared.map((h) => {
                        const other = bookB.holdings.find((g) => g.t === h.t);
                        return (
                          <div className="kv" key={h.t}>
                            <span className="kv-k">
                              <Link href={nameHref(h.t)} className="tlink">
                                {h.t}
                              </Link>
                            </span>
                            <span className="kv-v">
                              {h.pct}% / {other?.pct}%
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="faint" style={{ fontSize: 13 }}>
                        Nothing. These two claims share no name at all.
                      </p>
                    )}
                  </div>
                </div>
                <div className="cell c2">
                  <h3>Only A</h3>
                  <p className="p" style={{ fontSize: 12.5, marginTop: 6 }}>
                    What you own if A is right and B is not.
                  </p>
                  <div style={{ marginTop: 12 }}>
                    {onlyA.map((h) => (
                      <div className="kv" key={h.t}>
                        <span className="kv-k">
                          <Link href={nameHref(h.t)} className="tlink">
                            {h.t}
                          </Link>
                        </span>
                        <span className="kv-v">{h.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="cell c2">
                  <h3>Only B</h3>
                  <p className="p" style={{ fontSize: 12.5, marginTop: 6 }}>
                    And the mirror of it.
                  </p>
                  <div style={{ marginTop: 12 }}>
                    {onlyB.map((h) => (
                      <div className="kv" key={h.t}>
                        <span className="kv-k">
                          <Link href={nameHref(h.t)} className="tlink">
                            {h.t}
                          </Link>
                        </span>
                        <span className="kv-v">{h.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="window rv" style={{ marginTop: 12 }}>
                <div className="wbar">
                  <div className="wdots">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="wurl">A above, B below</div>
                </div>
                <div className="wbody">
                  <Bar holdings={bookA.holdings} />
                  <div style={{ height: 10 }} />
                  <Bar holdings={bookB.holdings} />
                  <BarFoot />
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="rv" style={{ marginTop: 12 }}>
          <p className="p" style={{ fontSize: 13, marginBottom: 14 }}>
            Or try a pair that genuinely disagrees
          </p>
          <div className="bento" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {[
              [
                "Compute is the binding constraint on artificial intelligence, not model design.",
                "Electricity demand grows for the first time in twenty years, and the grid cannot be built quickly.",
              ],
              [
                "Firm carbon-free baseload becomes acceptable again because nothing else clears the demand.",
                "Electricity demand grows for the first time in twenty years, and the grid cannot be built quickly.",
              ],
              [
                "Machines that manipulate the physical world become cheap enough to replace repetitive human labour.",
                "The final mile of delivery is automated and re-priced, because it is where most of the cost sits.",
              ],
            ].map(([x, y]) => (
              <Link
                key={x}
                className="cell"
                href={`/compare?a=${encodeURIComponent(x)}&b=${encodeURIComponent(y)}`}
                style={{ gridColumn: "span 1", padding: 16 }}
              >
                <h3 style={{ fontSize: 13.5 }}>{x.slice(0, 46)}…</h3>
                <p className="p" style={{ fontSize: 12, marginTop: 6 }}>
                  against {y.slice(0, 44)}…
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
