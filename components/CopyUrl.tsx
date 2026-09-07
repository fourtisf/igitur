"use client";

import { useState } from "react";

import { toast } from "./Toast";

/** Copies the book's address. Falls back to a hidden textarea where the
 *  clipboard API is unavailable or blocked. */
export function CopyUrl({ display }: { display: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing else to try */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast("Address copied");
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="urlbox" style={{ marginTop: 12 }}>
      <code>{display}</code>
      <button className="copyb" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
