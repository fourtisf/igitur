"use client";

import { useRef, useState } from "react";

/**
 * Client-side filtering over server-rendered rows.
 *
 * The rows themselves are rendered on the server so a crawler sees the whole
 * universe, not an empty container waiting for JavaScript. This only hides and
 * shows what is already in the document. Rows opt in with `data-find`; the
 * empty-state element opts in with `data-empty`.
 */
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
  const [q, setQ] = useState("");

  function apply(next: string) {
    setQ(next);
    const root = host.current;
    if (!root) return;
    const needle = next.trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll<HTMLElement>("[data-find]").forEach((el) => {
      const ok = !needle || (el.dataset.find ?? "").includes(needle);
      el.style.display = ok ? "" : "none";
      if (ok) shown++;
    });
    root.querySelectorAll<HTMLElement>("[data-empty]").forEach((el) => {
      el.style.display = shown ? "none" : "block";
    });
  }

  return (
    <div ref={host}>
      <div className="rv" style={wrapStyle ?? { marginTop: 24, maxWidth: 420 }}>
        <input
          className="srch"
          type="search"
          value={q}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => apply(e.target.value)}
        />
      </div>
      {children}
    </div>
  );
}
