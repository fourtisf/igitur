"use client";

import { useEffect } from "react";

import { remember } from "@/lib/history";

/** Records a premise in the in-memory session history when a book renders. */
export function Remember({ premise }: { premise: string }) {
  useEffect(() => {
    remember(premise);
  }, [premise]);
  return null;
}
