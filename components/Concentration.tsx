import { concentration, concentrationNote } from "@/lib/concentration";
import type { Holding } from "@/lib/types";

/**
 * The book's concentration, in figures.
 *
 * Placed above the holdings rather than below, because the list is what creates
 * the impression this corrects: twenty-three rows read as diversified whatever
 * the weights say.
 */
export function Concentration({ holdings }: { holdings: readonly Holding[] }) {
  const c = concentration(holdings);
  if (!c) return null;

  const cells: { k: string; v: string }[] = [
    { k: "Holdings", v: String(c.names) },
    { k: "Weighted like", v: `${c.effectiveNames.toFixed(1)} equal ones` },
    { k: "Largest", v: `${c.top.ticker} at ${c.top.pct.toFixed(1)}%` },
    { k: "Half the portfolio", v: `${c.namesForHalf} name${c.namesForHalf > 1 ? "s" : ""}` },
    { k: "Exposed to the premise", v: `${c.atRisk.toFixed(0)}%` },
  ];

  return (
    <div className="cell" style={{ padding: "clamp(16px,2.2vw,24px)" }}>
      <h3 style={{ fontSize: 15 }}>How concentrated this is</h3>
      <div style={{ marginTop: 12 }}>
        {cells.map((c2) => (
          <div className="kv" key={c2.k}>
            <span className="kv-k">{c2.k}</span>
            <span className="kv-v">{c2.v}</span>
          </div>
        ))}
      </div>
      <p className="p" style={{ marginTop: 12, fontSize: 13.5 }}>
        {/* Read from the weights, never from the premise, so it cannot end up
            flattering the thesis it is supposed to test. */}
        {concentrationNote(c)}
      </p>
    </div>
  );
}
