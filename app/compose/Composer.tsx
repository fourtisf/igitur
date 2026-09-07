"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { bookHref } from "@/lib/routes";
import { THEMES } from "@/lib/universe";

/**
 * The composer. Autofocus, Enter submits, Shift+Enter breaks the line.
 *
 * Picking a theme cell here fills the field rather than navigating, so the
 * reader can see and edit the claim before building it — that is what the
 * prototype did, and it is why the cells are buttons on this page and links
 * everywhere else.
 */
export function Composer({ prefill = "" }: { prefill?: string }) {
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

  function go(text: string) {
    const v = text.trim();
    if (v) router.push(bookHref(v));
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
        Or start from a written thesis — all {THEMES.length} of them
      </p>
      <div className="rv">
        <div className="bento" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          {THEMES.map((th) => (
            <button
              key={th.id}
              className="cell"
              onClick={() => pick(th.claim)}
              style={{ gridColumn: "span 1", padding: 16 }}
            >
              <h3 style={{ fontSize: 14 }}>{th.name}</h3>
              <p className="p" style={{ fontSize: 12, marginTop: 5 }}>
                {th.assets.length} names · {th.risk}
              </p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
