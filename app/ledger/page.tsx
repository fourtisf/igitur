import type { Metadata } from "next";
import Link from "next/link";

import { LedgerControls } from "@/components/LedgerControls";
import { buildBook } from "@/lib/generator";
import { all } from "@/lib/ledger";
import { daysUntil, isSettled } from "@/lib/horizon";
import { marketIsReal } from "@/lib/market";
import { daysSince } from "@/lib/routes";
import { trackBook } from "@/lib/track";
import { twitterCard } from "@/lib/twitter-card";
import { pageOg } from "@/lib/og-pages";
import { HOST, SITE } from "@/lib/site";
import { THEMES } from "@/lib/universe";

/**
 * Everything anyone put on the record, and how it has done.
 *
 * This is the page the rest of the site exists to fill. A generator that
 * forgets is a toy; a public list of dated claims that can be checked against
 * what happened is the thing worth coming back to. Nobody's book is hidden
 * because it lost — that is the same rule as the centred benchmark, applied to
 * the record instead of the chart.
 */

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The record",
  description:
    "Every premise anyone put on the record, the date the server witnessed it, and how the book has done against the index since. Losers included.",
  alternates: { canonical: "/ledger" },
  openGraph: {
    url: "/ledger",
    title: `The record — ${SITE.name}`,
    description: "Dated claims, measured against the index. Losers included.",
    images: [{ url: pageOg("home"), width: 1200, height: 630 }],
  },
  twitter: twitterCard(pageOg("home")),
};

/** Newest first is the default; this page is a record, not a leaderboard. */
const SHOW = 200;

export default async function LedgerPage() {
  const entries = (await all()).slice(0, SHOW);
  const live = await marketIsReal();

  const rows = await Promise.all(
    entries.map(async (e) => {
      const book = buildBook(e.premise);
      const settled = isSettled(e.settlesAt);
      if (!book.ok) return { e, book: null, track: null, settled };
      // A settled claim is measured to its date and never past it, here as on
      // its own page — the two must not disagree about what happened.
      const until = settled ? (e.settlesAt ?? null) : null;
      const days = settled
        ? Math.round(
            (Date.parse(e.settlesAt + "T00:00:00Z") - Date.parse(e.statedAt + "T00:00:00Z")) /
              86_400_000
          )
        : daysSince(e.statedAt);
      return { e, book, track: await trackBook(book, e.statedAt, days, until), settled };
    })
  );

  // Two lists that give the record a reason to be revisited. A dated claim
  // nobody comes back to is a dated claim nobody is held to.
  const soon = rows
    .filter((r) => !r.settled && r.e.settlesAt && (daysUntil(r.e.settlesAt) ?? 999) <= 30)
    .sort((a, b) => (a.e.settlesAt ?? "").localeCompare(b.e.settlesAt ?? ""));
  const justSettled = rows
    .filter((r) => r.settled && (daysUntil(r.e.settlesAt) ?? -999) > -30)
    .sort((a, b) => (b.e.settlesAt ?? "").localeCompare(a.e.settlesAt ?? ""));

  const measured = rows.filter((r) => r.track?.live);
  const ahead = measured.filter((r) => r.track!.bookEnd >= r.track!.indexEnd).length;
  const themeName = (id: string) => THEMES.find((t) => t.id === id)?.name ?? id;

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">The record</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
        What people said, and what happened next.
      </h1>
      <p className="sub rv" style={{ marginTop: 18, maxWidth: "56ch" }}>
        Every claim below was committed on purpose, and the date beside it was written by the server
        on the day — not taken from a link. Nothing is removed for having been wrong. The ones marked{" "}
        <b className="ac">House</b> are Igitur&rsquo;s own published theses, committed by the
        project on the same terms as everyone else&rsquo;s — same dating, same settlement, and
        the same inability to withdraw one that goes wrong.{" "}
        {/* No account and no email, so the only way a claim reaches anyone
            again is if they choose to be told. */}
        <a href="/feed.xml">Follow the record as a feed</a> to hear when claims are made and when
        they are judged.
      </p>

      {!entries.length ? (
        <div className="cell rv" style={{ marginTop: 28, padding: "clamp(24px,3.4vw,40px)" }}>
          <h3>Nothing on the record yet.</h3>
          <p className="p" style={{ marginTop: 10, maxWidth: "48ch" }}>
            The first claim here will be the oldest one on the site, which is the only thing about
            it that cannot be caught up with later.
          </p>
          <div className="hero-cta" style={{ justifyContent: "flex-start", marginTop: 22 }}>
            <Link className="b1" href="/compose">
              Write one
            </Link>
          </div>
        </div>
      ) : (
        <>
          {justSettled.length ? (
            <div className="cell rv" style={{ marginTop: 22, padding: "clamp(18px,2.4vw,26px)" }}>
              <h3>Settled in the last month</h3>
              <p className="p" style={{ marginTop: 8, fontSize: 13.5 }}>
                These are finished. The figure beside each one was fixed on its settlement date and
                does not move again.
              </p>
              <div style={{ marginTop: 12 }}>
                {justSettled.slice(0, 8).map(({ e, track }) => {
                  const held = (track?.bookEnd ?? 0) >= (track?.indexEnd ?? 0);
                  return (
                    <div className="kv" key={e.id}>
                      <span className="kv-k">
                        <Link href={`/p/${e.id}`}>{e.premise}</Link>
                      </span>
                      <span className="kv-v">
                        <span className={"pill " + (held ? "pon" : "poff")}>
                          {held ? "Held" : "Failed"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {soon.length ? (
            <div className="cell rv" style={{ marginTop: 18, padding: "clamp(18px,2.4vw,26px)" }}>
              <h3>Settling within thirty days</h3>
              <p className="p" style={{ marginTop: 8, fontSize: 13.5 }}>
                Still open. On the date beside each one the record states what happened and stops.
              </p>
              <div style={{ marginTop: 12 }}>
                {soon.slice(0, 8).map(({ e }) => (
                  <div className="kv" key={e.id}>
                    <span className="kv-k">
                      <Link href={`/p/${e.id}`}>{e.premise}</Link>
                    </span>
                    <span className="kv-v">{e.settlesAt}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="notice rv" style={{ marginTop: 22 }}>
            {entries.length} claim{entries.length > 1 ? "s" : ""} on the record.{" "}
            {live && measured.length
              ? `${ahead} of ${measured.length} are ahead of the index.`
              : "Performance is synthetic until a market data vendor is configured, so no standing is shown."}
          </p>

          <LedgerControls>
          <div className="window rv" style={{ marginTop: 18 }}>
            <div className="wbar">
              <div className="wdots">
                <i /><i /><i />
              </div>
              <div className="wurl">{HOST}/ledger</div>
            </div>
            <div className="wbody" style={{ padding: "16px 12px 14px" }}>
              <div className="lhead">
                <span>Stated</span>
                <span>Claim</span>
                <span>Theme</span>
                <span>Book</span>
                <span>Index</span>
              </div>
              {rows.map(({ e, book, track, settled }, i) => (
                <Link
                  key={e.id}
                  className="lrow"
                  href={`/p/${e.id}`}
                  /* The sort and the filter both read these. `lead` is empty
                     rather than 0 when the figures are not real, so a claim
                     with nothing measured yet sorts last instead of
                     outranking a genuine loss.

                     Block comment, not `//`: a line comment inside a JSX
                     opening tag makes the build silently drop an edit to the
                     attribute below it — no error, no warning, just yesterday's
                     value in today's HTML. It cost an afternoon on /universe. */
                  data-find={`${e.premise} ${book ? themeName(book.theme.id) : ""} ${e.statedAt}`.toLowerCase()}
                  data-lead={track?.live ? (track.bookEnd - track.indexEnd).toFixed(4) : ""}
                  data-order={i}
                >
                  <span className="ldate">{e.statedAt}</span>
                  <span className="lclaim">
                    {e.premise}
                    {e.house ? <i className="ac"> · house</i> : null}
                    {settled ? <i style={{ color: "var(--fg-4)" }}> · settled</i> : null}
                  </span>
                  <span className="ltheme">{book ? themeName(book.theme.id) : "—"}</span>
                  <span className={"lnum " + (track?.live && track.bookEnd >= 0 ? "up" : "down")}>
                    {track?.live ? `${track.bookEnd >= 0 ? "+" : ""}${track.bookEnd.toFixed(1)}%` : "—"}
                  </span>
                  <span className="lnum" style={{ color: "var(--fg-4)", fontWeight: 500 }}>
                    {track?.live ? `${track.indexEnd >= 0 ? "+" : ""}${track.indexEnd.toFixed(1)}%` : "—"}
                  </span>
                </Link>
              ))}
              <p
                className="faint"
                data-empty
                style={{ display: "none", padding: "22px 4px", fontSize: 13 }}
              >
                No claim on the record matches that.
              </p>
            </div>
          </div>
          </LedgerControls>
        </>
      )}
    </section>
  );
}
