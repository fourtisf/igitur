"use client";

import { useState } from "react";

/**
 * The address, and a button that copies it.
 *
 * Launch day is the one day this site has a field people must transfer
 * somewhere else exactly. Forty hex characters retyped by hand, or selected by
 * dragging on a phone, is how somebody ends up on a fake address that starts
 * with the same six characters — the oldest trick there is. The button exists
 * so nobody has to.
 *
 * It shows what happened rather than assuming: clipboard access is refused in
 * some browsers and inside some in-app webviews, and a button that silently
 * does nothing on the most important field of the day is worse than no button.
 */
export function CopyAddress({ address }: { address: string }) {
  const [said, setSaid] = useState<"" | "Copied" | "Select it manually">("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setSaid("Copied");
    } catch {
      setSaid("Select it manually");
    }
    setTimeout(() => setSaid(""), 2600);
  }

  return (
    <div className="addrbox" style={{ marginTop: 14 }}>
      <code>{address}</code>
      <button className="copyb" onClick={copy} aria-label="Copy the contract address">
        {said || "Copy"}
      </button>
    </div>
  );
}
