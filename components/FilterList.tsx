"use client";

import { useEffect, useRef } from "react";

/**
 * Client-side filtering over server-rendered rows.
 *
 * The rows themselves are rendered on the server so a crawler sees the whole
 * universe, not an empty container waiting for JavaScript. This only hides and
 * shows what is already in the document. Rows opt in with `data-find`; the
 * empty-state element opts in with `data-empty`.
 *
 * A `?q=` in the address seeds the box, so a link can land someone on a
 * filtered view — which is what makes the theme name on a book page worth
 * clicking. It is read from the browser rather than from searchParams on
 * purpose: reading it on the server would make this page render on demand and
 * cost the static prerender that puts the whole universe in front of a crawler.
 */
function filter(root: HTMLElement | null, next: string): void {
  if (!root) return;
  const needle = next.trim().toLowerCase();
  let shown = 0;
  root.querySelectorAll<HTMLElement>("[data-find]").forEach((el) => {
    const ok = !needle || (el.dataset.find ?? "").toLowerCase().includes(needle);
    el.style.display = ok ? "" : "none";
    if (ok) shown++;
  });
  root.querySelectorAll<HTMLElement>("[data-empty]").forEach((el) => {
    el.style.display = shown ? "none" : "block";
  });
}

export function FilterList({
  placeholder,
  label,
  wrapStyle,
  children,
}: {
  placeholder: string;
  label: string;
  wrapStyle?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  // Uncontrolled: the box holds its own text. A controlled value seeded from
  // the address would differ between the server's render and the browser's,
  // and React calls that a hydration error.
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // After the children are in the document, never before: this hides rows
    // that only exist once they have rendered.
    let seed = "";
    try {
      seed = new URLSearchParams(window.location.search).get("q") ?? "";
    } catch {
      seed = "";
    }
    if (!seed) return;
    if (box.current) box.current.value = seed;
    filter(host.current, seed);
  }, []);

  return (
    <div ref={host}>
      <div className="rv" style={wrapStyle ?? { marginTop: 24, maxWidth: 420 }}>
        <input
          ref={box}
          className="srch"
          type="search"
          defaultValue=""
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => filter(host.current, e.target.value)}
        />
      </div>
      {children}
    </div>
  );
}
