"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Reads the reduced-motion preference as derived state rather than pushing it
 * into an effect, so a reader who prefers no motion never sees a frame of the
 * animation. HANDOFF.md §11 — the preference is fully respected.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia ? window.matchMedia(QUERY).matches : false),
    // Assume reduced motion on the server: the markup then ships in its
    // finished state and the animation only starts once the client says it may.
    () => true
  );
}
