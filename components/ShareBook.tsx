"use client";

import { useState } from "react";

import { SITE } from "@/lib/site";
import { XIcon } from "./icons";
import { toast } from "./Toast";

/**
 * Sharing a book. HANDOFF.md §6.2 makes the share image the largest growth
 * lever there is; a card nobody has a button to post is only half of that.
 *
 * The X link is built on the client from the address bar, so it always carries
 * whatever the reader is actually looking at — including any holdings they
 * removed.
 */
export function ShareBook({ display, premise }: { display: string; premise: string }) {
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

  function shareToX() {
    const text = `I believe ${premise}`;
    const url = new URL("https://x.com/intent/tweet");
    url.searchParams.set("text", text);
    url.searchParams.set("url", window.location.href);
    url.searchParams.set("via", SITE.xHandle.replace(/^@/, ""));
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="urlbox" style={{ marginTop: 12 }}>
        <code>{display}</code>
        <button className="copyb" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button
        className="b2"
        onClick={shareToX}
        style={{ marginTop: 10, width: "100%", justifyContent: "center", gap: 9 }}
      >
        <XIcon size={13} />
        Share on X
      </button>
    </>
  );
}
