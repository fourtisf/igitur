"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buildBook } from "@/lib/generator";
import { ago, EMPTY, snapshot, subscribe } from "@/lib/history";
import { bookHref } from "@/lib/routes";
import { HOST } from "@/lib/site";

/**
 * Session history. Memory only — it dies on refresh, which is why every book
 * carries its own address. HANDOFF.md §14; persistence is step 4 of §12.
 */
export function HistoryList() {
  const entries = useSyncExternalStore(subscribe, snapshot, () => EMPTY);

  if (!entries.length) {
    return (
      <div
        className="cell rv"
        style={{ marginTop: "clamp(26px,3.5vw,44px)", padding: "clamp(24px,3vw,40px)" }}
      >
        <h3>Nothing here yet.</h3>
        <p className="p" style={{ marginTop: 8, maxWidth: "40ch" }}>
          Build a book and it appears in this list for the rest of the session.
        </p>
        <Link className="b1" style={{ marginTop: 18 }} href="/compose">
          Compose a book
        </Link>
      </div>
    );
  }

  return (
    <div className="window rv" style={{ marginTop: "clamp(26px,3.5vw,44px)" }}>
      <div className="wbar">
        <div className="wdots">
          <i />
          <i />
          <i />
        </div>
        <div className="wurl">{HOST}/history</div>
      </div>
      <div className="wbody">
        {entries.map((h) => {
          const bb = buildBook(h.p);
          return (
            <Link key={h.p} className="hrow" href={bookHref(h.p)} style={{ ["--fw" as string]: "0%" }}>
              <span
                className="hw"
                style={{ width: "auto", minWidth: 64, fontSize: 12, color: "var(--fg-4)" }}
              >
                {ago(h.at)}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="hn">{h.p}</span>
                <div className="hm">
                  {bb.ok
                    ? `${bb.theme.name} · ${bb.holdings.length} holdings · ${bb.risk}`
                    : "No match"}
                </div>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
