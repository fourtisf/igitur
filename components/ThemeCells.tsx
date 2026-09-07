import Link from "next/link";

import { THEMES, UNIVERSE_VERSION } from "@/lib/universe";
import { bookHref } from "@/lib/routes";

/**
 * All 26 themes as a grid. Each cell is a link to that theme's own book, so the
 * whole universe is reachable — and crawlable — from any page that shows it.
 */
export function ThemeCells() {
  return (
    <div className="bento" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
      {THEMES.map((th) => (
        <Link
          key={th.id}
          className="cell"
          href={bookHref(th.claim, [], { universe: UNIVERSE_VERSION })}
          style={{ gridColumn: "span 1", padding: 16 }}
        >
          <h3 style={{ fontSize: 14 }}>{th.name}</h3>
          <p className="p" style={{ fontSize: 12, marginTop: 5 }}>
            {th.assets.length} names · {th.risk}
          </p>
        </Link>
      ))}
    </div>
  );
}
