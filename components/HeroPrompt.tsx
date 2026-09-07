"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero typing sequence, then the bar reveal. One of the four motions in the
 * budget — HANDOFF.md §11. It runs once.
 *
 * Under prefers-reduced-motion the text is set immediately and the bar is
 * revealed without animation.
 */
export function HeroPrompt({ text, children }: { text: string; children: React.ReactNode }) {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyped(text);
      setDone(true);
      return;
    }
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setTyped(text.slice(0, i));
      if (i < text.length) t = setTimeout(tick, 26 + Math.random() * 34);
      else t = setTimeout(() => setDone(true), 260);
    };
    t = setTimeout(tick, 700);
    return () => clearTimeout(t);
  }, [text]);

  // Stagger the bar segments once typing finishes.
  useEffect(() => {
    if (!done) return;
    const bar = host.current?.querySelector<HTMLElement>(".bar");
    if (!bar) return;
    Array.from(bar.children).forEach((seg, k) => {
      (seg as HTMLElement).style.animationDelay = k * 70 + "ms";
    });
    bar.classList.add("go");
  }, [done]);

  return (
    <div ref={host}>
      <div className="prompt">
        <span className="pre">I believe</span>
        <span className="txt">
          {typed}
          {!done ? <span className="caret" /> : null}
        </span>
      </div>
      {children}
    </div>
  );
}
