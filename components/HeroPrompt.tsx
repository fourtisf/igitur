"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "./useReducedMotion";

/**
 * The hero typing sequence, then the bar reveal. One of the four motions in the
 * budget — HANDOFF.md §11. It runs once.
 *
 * Under prefers-reduced-motion nothing animates: the text renders complete and
 * the bar is revealed immediately.
 */
export function HeroPrompt({ text, children }: { text: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  const shown = reduce ? text : typed;
  const done = reduce || typingDone;

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setTyped(text.slice(0, i));
      if (i < text.length) t = setTimeout(tick, 26 + Math.random() * 34);
      else t = setTimeout(() => setTypingDone(true), 260);
    };
    t = setTimeout(tick, 700);
    return () => clearTimeout(t);
  }, [reduce, text]);

  // Stagger the bar segments once typing finishes.
  useEffect(() => {
    if (!done) return;
    const bar = host.current?.querySelector<HTMLElement>(".bar");
    if (!bar) return;
    if (!reduce) {
      Array.from(bar.children).forEach((seg, k) => {
        (seg as HTMLElement).style.animationDelay = k * 70 + "ms";
      });
    }
    bar.classList.add("go");
  }, [done, reduce]);

  return (
    <div ref={host}>
      <div className="prompt">
        <span className="pre">I believe</span>
        <span className="txt">
          {shown}
          {!done ? <span className="caret" /> : null}
        </span>
      </div>
      {children}
    </div>
  );
}
