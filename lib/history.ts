"use client";

/**
 * Session history — HANDOFF.md §14.
 *
 * Held in memory only. It survives client-side navigation and dies on refresh,
 * exactly as the prototype did, and /status lists "history that survives a page
 * refresh" as not built. That is honest, not an oversight: persistence is step 4
 * of the build order (§12) and needs a store behind it.
 *
 * Deliberately NOT localStorage or sessionStorage — /legal promises that what
 * you type stays in your browser and disappears when you close the tab.
 */

export interface Entry {
  p: string;
  at: number;
}

let HISTORY: Entry[] = [];
const listeners = new Set<() => void>();

export function remember(premise: string) {
  const p = premise.trim();
  if (!p) return;
  if (HISTORY[0]?.p === p) return;
  HISTORY = [{ p, at: Date.now() }, ...HISTORY.filter((x) => x.p !== p)].slice(0, 20);
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function snapshot(): Entry[] {
  return HISTORY;
}

/** Stable empty array so useSyncExternalStore does not loop on the server. */
export const EMPTY: Entry[] = [];

export function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return Math.floor(s / 86400) + " d ago";
}
