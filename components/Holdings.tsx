import Link from "next/link";
import type { Holding } from "@/lib/types";
import { fmtMcap, mcapOf, priceOf } from "@/lib/market";
import { nameHref } from "@/lib/names";

/**
 * Every holding, with the sentence that justifies its size.
 *
 * The remove control is a Link, not a button, so reweighting works without
 * client JavaScript and every reweighted book has a real, crawlable URL.
 */
export function Holdings({
  holdings,
  removeHref,
  stepHref,
}: {
  holdings: Holding[];
  /** Given a ticker, the URL of this book with that holding removed. */
  removeHref?: (ticker: string) => string;
  /** Given a ticker and a delta, the URL of this book with that weight nudged.
   *  A Link, not a slider, so adjusting works without JavaScript and every
   *  adjusted book keeps a real, shareable address. */
  stepHref?: (ticker: string, delta: number) => string | null;
}) {
  const max = holdings[0].pct;
  return (
    <>
      {holdings.map((x) => (
        <div
          key={x.t}
          className={"hrow" + (x.ballast ? " bal" : "")}
          style={{ ["--fw" as string]: `${((x.pct / max) * 100).toFixed(1)}%` }}
        >
          <span className="hw">{x.pct}%</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="hn">{x.n}</span>
            <div className="hy">{x.why}</div>
            <div className="hm">
              <Link href={nameHref(x.t)} className="tlink">
                {x.t}
              </Link>{" "}
              · {x.k} · ${priceOf(x.t).toFixed(2)} · {fmtMcap(mcapOf(x.t))} · {x.src}
            </div>
          </span>
          {stepHref && !x.ballast ? (
            <span className="step">
              {[-1, 1].map((d) => {
                const href = stepHref(x.t, d);
                return href ? (
                  <Link
                    key={d}
                    href={href}
                    scroll={false}
                    aria-label={`${d < 0 ? "Decrease" : "Increase"} ${x.t} by one point`}
                    title={`${d < 0 ? "Down" : "Up"} 1%`}
                  >
                    {d < 0 ? "−" : "+"}
                  </Link>
                ) : (
                  <span key={d} aria-disabled="true" title="At the limit">
                    {d < 0 ? "−" : "+"}
                  </span>
                );
              })}
            </span>
          ) : null}
          {removeHref && !x.ballast ? (
            <Link
              className="hx"
              href={removeHref(x.t)}
              title="Remove and reweight"
              aria-label={`Remove ${x.t}`}
              scroll={false}
            >
              ×
            </Link>
          ) : null}
        </div>
      ))}
    </>
  );
}
