"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { scoreThemes } from "@/lib/generator";
import { MATCH_INDEX } from "@/lib/match-index";
import { normalizePremise } from "@/lib/premise";
import { bookHref, today } from "@/lib/routes";
import { UNIVERSE_VERSION } from "@/lib/universe";

/**
 * The composer. Autofocus, Enter submits, Shift+Enter breaks the line.
 *
 * Picking a theme cell here fills the field rather than navigating, so the
 * reader can see and edit the claim before building it — that is what the
 * prototype did, and it is why the cells are buttons on this page and links
 * everywhere else.
 */
export function Composer({
  prefill = "",
  claims,
  counts,
}: {
  prefill?: string;
  /** Theme claims, passed from the server so the prose stays off the wire. */
  claims: Record<string, string>;
  counts: Record<string, number>;
}) {
  const CLAIMS = claims;
  const COUNTS = counts;
  const router = useRouter();
  const field = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(prefill);
  const [hot, setHot] = useState(false);

  function grow() {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  useEffect(() => {
    grow();
    field.current?.focus();
  }, []);

  useEffect(() => {
    grow();
  }, [value]);

  /**
   * What the matcher currently makes of the sentence, recomputed as it is
   * typed. This uses the same scorer the book is built with, so it cannot
   * promise a theme the book then refuses.
   *
   * It shows the reader the vocabulary the matcher actually reads, which is
   * the honest way to reduce refusals — the refusal itself stays exactly as
   * strict as it was.
   */
  const read = useMemo(() => {
    const text = normalizePremise(value);
    if (text.length < 3) return null;
    const ranked = scoreThemes(text, MATCH_INDEX);
    const top = ranked[0];
    if (!top || top.score === 0) return { matched: false as const };
    const confidence = Math.min(96, 26 + top.hits.length * 14 + (top.score > 12 ? 8 : 0));
    return { matched: true as const, name: top.th.name, risk: top.th.risk, hits: top.hits, confidence };
  }, [value]);

  function go(text: string) {
    const v = text.trim();
    if (v) router.push(bookHref(v, [], { universe: UNIVERSE_VERSION, stated: today() }));
  }

  function pick(claim: string) {
    setValue(claim);
    const el = field.current;
    if (!el) return;
    el.focus();
    try {
      el.setSelectionRange(claim.length, claim.length);
    } catch {
      /* Some browsers throw on a field that is not yet laid out. */
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return (
    <>
      <div
        className={"composer rv" + (hot ? " hot" : "")}
        style={{ marginTop: "clamp(28px,4vw,44px)" }}
      >
        <div className="cfield">
          <span className="cpre">I believe</span>
          <textarea
            className="cin"
            ref={field}
            rows={1}
            value={value}
            placeholder="that fresh water becomes the constraint climate spending is organised around."
            aria-label="Your premise"
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setHot(true)}
            onBlur={() => setHot(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                go(value);
              }
            }}
          />
        </div>
        {read ? (
          <div className="matchline" aria-live="polite">
            {read.matched ? (
              <>
                <span className="mdot" />
                <b>{read.name}</b>
                <span className="faint">{read.risk}</span>
                <span className="faint">
                  matched {read.hits.length} term{read.hits.length === 1 ? "" : "s"}
                  {read.hits.length ? `: ${read.hits.slice(0, 4).join(", ")}` : ""}
                </span>
                <span className={"mconf" + (read.confidence < 50 ? " warn" : "")}>
                  {read.confidence}%
                </span>
              </>
            ) : (
              <>
                <span className="mdot off" />
                <span className="faint">
                  No theme carries this yet — name a constraint, an industry or a resource.
                </span>
              </>
            )}
          </div>
        ) : null}

        <div className="crow2">
          <button className="b1" onClick={() => go(value)}>
            Build the book
          </button>
          <button
            className="chip"
            onClick={() => {
              setValue("");
              field.current?.focus();
            }}
          >
            Clear
          </button>
          <span className="faint" style={{ fontSize: 12 }}>
            Enter to build
          </span>
        </div>
      </div>

      <p className="p rv" style={{ margin: "clamp(30px,4vw,46px) 0 14px", fontSize: 13 }}>
        Or start from a written thesis — all {MATCH_INDEX.length} of them
      </p>
      <div className="rv">
        <div className="bento" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          {MATCH_INDEX.map((th) => (
            <button
              key={th.id}
              className="cell"
              onClick={() => pick(CLAIMS[th.id])}
              style={{ gridColumn: "span 1", padding: 16 }}
            >
              <h3 style={{ fontSize: 14 }}>{th.name}</h3>
              <p className="p" style={{ fontSize: 12, marginTop: 5 }}>
                {COUNTS[th.id]} names · {th.risk}
              </p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
