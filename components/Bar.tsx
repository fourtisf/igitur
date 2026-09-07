import type { Holding } from "@/lib/types";

/**
 * The allocation bar. A signature component — HANDOFF.md §11. Reuse it, do not
 * redesign it.
 *
 * Colour carries information here; it is not decoration:
 *   white gradient          the lead position
 *   descending white alpha  conviction order
 *   indigo                  ballast
 *
 * Every segment carries its ticker, weight and reason in an aria-label, so a
 * screen reader gets the whole book from the bar alone. The segments are not
 * focusable: they do nothing when activated, and seven inert tab stops in front
 * of the holdings list costs a keyboard user more than it gives them. The same
 * information is in that list as ordinary text.
 */
export function Bar({
  holdings,
  size,
  animate,
}: {
  holdings: Holding[];
  /** "sm" renders the compact bar used on /track. */
  size?: "sm";
  /** Runs the one-off reveal. Suppressed under prefers-reduced-motion by CSS. */
  animate?: boolean;
}) {
  return (
    <div className={["bar", size ?? "", animate ? "go" : ""].filter(Boolean).join(" ")} role="list">
      {holdings.map((x, i) => {
        const k = x.lead ? "lead" : x.ballast ? "bal" : "";
        // Conviction order, expressed as descending white opacity.
        const tone: React.CSSProperties =
          x.lead || x.ballast
            ? {}
            : {
                background: `linear-gradient(180deg,rgba(255,255,255,${(0.145 - i * 0.014).toFixed(
                  3
                )}),rgba(255,255,255,${(0.052 - i * 0.004).toFixed(3)}))`,
              };
        return (
          <div
            key={x.t}
            className={[k, x.pct < 8 ? "narrow" : ""].filter(Boolean).join(" ")}
            role="listitem"
            aria-label={`${x.t}, ${x.pct} percent. ${x.why}`}
            style={{
              flex: `0 0 ${x.pct}%`,
              ...tone,
              ...(animate ? { animationDelay: `${i * 70}ms` } : {}),
            }}
          >
            <b>{x.t}</b>
            <em>{x.pct}%</em>
          </div>
        );
      })}
    </div>
  );
}

export function BarFoot() {
  return (
    <div className="barfoot">
      <span style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span className="dk">
          <i style={{ background: "#fff" }} />
          Lead position
        </span>
        <span className="dk">
          <i style={{ background: "rgba(255,255,255,.3)" }} />
          Conviction, descending
        </span>
        <span className="dk">
          <i style={{ background: "var(--ac)" }} />
          Ballast
        </span>
      </span>
      <span className="faint">Widths are weights · total 100%</span>
    </div>
  );
}
