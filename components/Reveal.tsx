"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Scroll fade-ins. Part of the small, deliberate motion budget — HANDOFF.md §11.
 *
 * Server components render the content and mark it `.rv`; this adds `.in` as it
 * scrolls into view. Re-runs on navigation because the App Router swaps the tree
 * without remounting the layout. Without IntersectionObserver everything is
 * simply shown, and `prefers-reduced-motion` is handled in CSS.
 */
export function Reveal() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".rv"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const x of entries) {
          if (!x.isIntersecting) continue;
          x.target.classList.add("in");
          io.unobserve(x.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 }
    );
    els.forEach((e, i) => {
      e.style.transitionDelay = Math.min(i * 45, 220) + "ms";
      io.observe(e);
    });
    return () => io.disconnect();
  }, [pathname, search]);

  return null;
}
