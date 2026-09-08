"use client";

import { useRef, useState } from "react";

type Sort = "newest" | "ahead" | "behind";

/**
 * Search and sort over the record.
 *
 * The rows are rendered on the server, so a crawler and a reader with no
 * JavaScript both get the whole record in date order. This reorders and hides
 * what is already in the document, which is also why /ledger can stay
 * prerendered rather than rebuilding on every sort.
 *
 * Rows opt in with `data-find` (searchable text) and `data-lead` (the book's
 * margin over the index, or empty when the figures are not real yet).
 */
export function LedgerControls({ children }: { children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  function rows(): HTMLElement[] {
    const root = host.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>("[data-find]"));
  }

  function apply(nextQ: string, nextSort: Sort) {
    const root = host.current;
    if (!root) return;
    const list = rows();
    if (!list.length) return;
    const parent = list[0].parentElement;
    if (!parent) return;

    if (nextSort !== "newest") {
      const scored = list.map((el) => ({
        el,
        // A row with no real figures sorts last either way rather than being
        // treated as a zero, which would rank it above every genuine loss.
        lead: el.dataset.lead === "" ? null : Number(el.dataset.lead),
      }));
      scored.sort((a, b) => {
        if (a.lead === null) return b.lead === null ? 0 : 1;
        if (b.lead === null) return -1;
        return nextSort === "ahead" ? b.lead - a.lead : a.lead - b.lead;
      });
      for (const { el } of scored) parent.appendChild(el);
    } else {
      const byDate = [...list].sort(
        (a, b) => Number(a.dataset.order ?? 0) - Number(b.dataset.order ?? 0)
      );
      for (const el of byDate) parent.appendChild(el);
    }

    const needle = nextQ.trim().toLowerCase();
    let shown = 0;
    for (const el of rows()) {
      const ok = !needle || (el.dataset.find ?? "").includes(needle);
      el.style.display = ok ? "" : "none";
      if (ok) shown++;
    }
    root.querySelectorAll<HTMLElement>("[data-empty]").forEach((el) => {
      el.style.display = shown ? "none" : "block";
    });
  }

  const tab = (id: Sort, label: string) => (
    <button
      key={id}
      type="button"
      className={"chip" + (sort === id ? " on" : "")}
      aria-pressed={sort === id}
      onClick={() => {
        setSort(id);
        apply(q, id);
      }}
    >
      {label}
    </button>
  );

  return (
    <div ref={host}>
      <div
        className="rv"
        style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          className="srch"
          style={{ maxWidth: 360, flex: "1 1 240px" }}
          type="search"
          placeholder="Search claims…"
          aria-label="Search the record"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            apply(e.target.value, sort);
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tab("newest", "Newest")}
          {tab("ahead", "Furthest ahead")}
          {tab("behind", "Furthest behind")}
        </div>
      </div>
      {children}
    </div>
  );
}
