"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Two fields, one submit. The comparison itself is server-rendered, so the
 *  result has a real, shareable URL like every other page here. */
export function CompareForm({ a, b }: { a: string; b: string }) {
  const router = useRouter();
  const [pa, setPa] = useState(a);
  const [pb, setPb] = useState(b);

  function go() {
    if (!pa.trim() || !pb.trim()) return;
    router.push(`/compare?a=${encodeURIComponent(pa.trim())}&b=${encodeURIComponent(pb.trim())}`);
  }

  return (
    <div className="composer rv" style={{ marginTop: "clamp(28px,4vw,44px)" }}>
      {([
        ["A", pa, setPa, "that compute is the binding constraint on AI."],
        ["B", pb, setPb, "that energy is the binding constraint, not compute."],
      ] as const).map(([label, val, set, ph]) => (
        <div className="cfield" key={label} style={{ marginBottom: 10 }}>
          <span className="cpre" style={{ fontSize: 15 }}>
            {label}
          </span>
          <textarea
            className="cin"
            rows={1}
            value={val}
            placeholder={ph}
            aria-label={`Premise ${label}`}
            style={{ fontSize: 17 }}
            onChange={(e) => set(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                go();
              }
            }}
          />
        </div>
      ))}
      <div className="crow2">
        <button className="b1" onClick={go}>
          Compare
        </button>
        <span className="faint" style={{ fontSize: 12 }}>
          Enter to compare
        </span>
      </div>
    </div>
  );
}
