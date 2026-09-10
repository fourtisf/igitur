"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Two fields, one submit. The comparison itself is server-rendered, so the
 *  result has a real, shareable URL like every other page here.
 *
 *  ── Why this says something when it cannot act ──────────────────────────────
 *
 *  It used to `return` on an empty field. Both fields carry a placeholder that
 *  reads as a real premise, and neither took focus, so the page looked like it
 *  arrived with two claims already typed in. Pressing Enter — which the hint
 *  underneath promises will work — did nothing at all, and so did the button.
 *  No error, no movement, nothing to correct. The reasonable conclusion is that
 *  the feature is broken, and it was reported as exactly that.
 *
 *  A form may refuse. It may not refuse silently. */
export function CompareForm({ a, b }: { a: string; b: string }) {
  const router = useRouter();
  const [pa, setPa] = useState(a);
  const [pb, setPb] = useState(b);
  const [hint, setHint] = useState<string | null>(null);
  const fieldA = useRef<HTMLTextAreaElement>(null);
  const fieldB = useRef<HTMLTextAreaElement>(null);

  function go() {
    const A = pa.trim();
    const B = pb.trim();

    // Name the field that is missing and put the cursor in it. "Fill in both
    // fields" leaves the reader to work out which one, on a form with two.
    if (!A && !B) {
      setHint("Write a claim in A, and the claim it argues against in B.");
      fieldA.current?.focus();
      return;
    }
    if (!A) {
      setHint("A is empty. Write the first claim, or pick a pair below.");
      fieldA.current?.focus();
      return;
    }
    if (!B) {
      setHint("B is empty — this compares two claims. Write the rival to A, or pick a pair below.");
      fieldB.current?.focus();
      return;
    }

    setHint(null);
    router.push(`/compare?a=${encodeURIComponent(A)}&b=${encodeURIComponent(B)}`);
  }

  return (
    <div className="composer rv" style={{ marginTop: "clamp(28px,4vw,44px)" }}>
      {([
        ["A", pa, setPa, fieldA, "that compute is the binding constraint on AI.", true],
        ["B", pb, setPb, fieldB, "that energy is the binding constraint, not compute.", false],
      ] as const).map(([label, val, set, ref, ph, first]) => (
        <div className="cfield" key={label} style={{ marginBottom: 10 }}>
          <span className="cpre" style={{ fontSize: 15 }}>
            {label}
          </span>
          <textarea
            className="cin"
            ref={ref}
            rows={1}
            value={val}
            placeholder={ph}
            aria-label={`Premise ${label}`}
            /* A is the page's primary action, so it takes focus the way the
               field on /compose does. A caret in the first box is also the
               plainest possible answer to "is that text or a placeholder". */
            autoFocus={first}
            style={{ fontSize: 17 }}
            onChange={(e) => {
              set(e.target.value);
              if (hint) setHint(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                go();
              }
            }}
          />
        </div>
      ))}

      {hint ? (
        <div className="matchline" aria-live="polite">
          <span className="mdot off" />
          <span className="faint">{hint}</span>
        </div>
      ) : null}

      <div className="crow2">
        <button className="b1" onClick={go}>
          Compare
        </button>
        <span className="faint" style={{ fontSize: 12 }}>
          Enter to compare · Shift+Enter for a new line
        </span>
      </div>
    </div>
  );
}
