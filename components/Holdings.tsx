import Link from "next/link";
import type { Holding } from "@/lib/types";
import { fmtMcap, mcapOf, priceOf } from "@/lib/market";

/**
 * Every holding, with the sentence that justifies its size.
 *
 * The remove control is a Link, not a button, so reweighting works without
 * client JavaScript and every reweighted book has a real, crawlable URL.
 */
export function Holdings({
  holdings,
  removeHref,
}: {
  holdings: Holding[];
  /** Given a ticker, the URL of this book with that holding removed. */
  removeHref?: (ticker: string) => string;
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
              {x.t} · {x.k} · ${priceOf(x.t).toFixed(2)} · {fmtMcap(mcapOf(x.t))} · {x.src}
            </div>
          </span>
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
