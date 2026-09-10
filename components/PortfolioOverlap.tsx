"use client";

import { useMemo, useState } from "react";

import { overlapNote, overlapWith, parsePortfolio } from "@/lib/overlap";
import type { Holding } from "@/lib/types";

/**
 * Does the reader's portfolio already say this?
 *
 * The site would build a book, argue both sides and measure it against the
 * index, and then stop one move short of the decision — leaving a list with no
 * way to know whether the belief was already expressed in what the reader owns.
 * Half the honest answers to "should I act on this?" are "you already have."
 *
 * Everything here happens in the browser. There is no endpoint that could
 * receive a portfolio, so there is nothing to store, nothing to leak and
 * nothing to promise about deletion — which is the only version of this feature
 * that belongs on a site whose /legal says it does not track its readers.
 */
export function PortfolioOverlap({ holdings }: { holdings: Holding[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const result = useMemo(() => {
    if (!text.trim()) return null;
    const { positions, ignored } = parsePortfolio(text);
    if (!positions.length) return { positions, ignored, o: null };
    return { positions, ignored, o: overlapWith(holdings, positions) };
  }, [text, holdings]);

  if (!open) {
    return (
      <button className="b2" type="button" onClick={() => setOpen(true)}>
        Do I already own this?
      </button>
    );
  }

  return (
    <div className="cell" style={{ padding: "clamp(16px,2.2vw,24px)" }}>
      <h3 style={{ fontSize: 15 }}>Do I already own this?</h3>
      <p className="p" style={{ marginTop: 8, fontSize: 13.5 }}>
        Paste your holdings — one per line, ticker first, size optional.{" "}
        <b>Nothing is sent anywhere.</b> This is worked out inside your browser; the site has no
        endpoint that could receive a portfolio, which is why it can say that without asking you to
        take its word for it.
      </p>

      <textarea
        className="ta"
        rows={6}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"NVDA 12%\nTSM 8\nSGOV 20\nAAPL"}
        aria-label="Your holdings, one per line"
        style={{ marginTop: 12, width: "100%" }}
      />

      {result && !result.o ? (
        <p className="notice warn" style={{ marginTop: 12, fontSize: 13 }}>
          No tickers found in that. A line should start with the symbol, like{" "}
          <code>NVDA 12%</code>.
        </p>
      ) : null}

      {result?.o ? (
        <div style={{ marginTop: 16 }}>
          <p className="notice">{overlapNote(result.o, holdings.length)}</p>

          <div style={{ marginTop: 14 }}>
            <div className="kv">
              <span className="kv-k">Names you already hold</span>
              <span className="kv-v">
                {result.o.shared.length} of {holdings.length}
              </span>
            </div>
            <div className="kv">
              <span className="kv-k">Of the portfolio, by weight</span>
              <span className="kv-v">{result.o.bookWeightHeld.toFixed(0)}%</span>
            </div>
            {result.o.yourWeightShared !== null ? (
              <div className="kv">
                <span className="kv-k">Of what you pasted</span>
                <span className="kv-v">
                  {result.o.yourWeightShared.toFixed(0)}%
                  {result.o.yourTotal !== null && Math.abs(result.o.yourTotal - 100) > 2
                    ? ` of ${result.o.yourTotal.toFixed(0)} pasted`
                    : ""}
                </span>
              </div>
            ) : null}
            <div className="kv">
              <span className="kv-k">Held, but not in this portfolio</span>
              <span className="kv-v">{result.o.outside.length}</span>
            </div>
          </div>

          {result.o.missing.length ? (
            <div style={{ marginTop: 16 }}>
              <div className="sl">What this belief would add, largest first</div>
              <div style={{ marginTop: 8 }}>
                {result.o.missing.slice(0, 8).map((m) => (
                  <div className="kv" key={m.ticker}>
                    <span className="kv-k">
                      {m.ticker} · {m.name}
                    </span>
                    <span className="kv-v">{m.bookPct.toFixed(1)}%</span>
                  </div>
                ))}
                {result.o.missing.length > 8 ? (
                  <p className="faint" style={{ marginTop: 8, fontSize: 12.5 }}>
                    and {result.o.missing.length - 8} smaller.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="notice" style={{ marginTop: 14 }}>
              Every name in this portfolio is already in what you pasted.
            </p>
          )}

          {result.ignored.length ? (
            <p className="faint" style={{ marginTop: 14, fontSize: 12.5 }}>
              {/* Said out loud, because a silently skipped line would quietly
                  make the overlap look smaller than it is. */}
              {result.ignored.length} line{result.ignored.length > 1 ? "s" : ""} had no ticker and
              {result.ignored.length > 1 ? " were" : " was"} skipped.
            </p>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button
          className="b2"
          type="button"
          onClick={() => {
            setText("");
            setOpen(false);
          }}
        >
          Close and clear
        </button>
      </div>
    </div>
  );
}
