import { Bar } from "@/components/Bar";
import type { Holding } from "@/lib/types";
import type { TrackResult } from "@/lib/track";

/** Chart box. Ported from the prototype and unchanged. */
const W = 1000;
const H = 340;
const PL = 6;
const PR = 64;
const PT = 18;
const PB = 28;

/**
 * The book against the index. HANDOFF.md §5.
 *
 * The benchmark is drawn whether or not it flatters the book. Where the figures
 * come from is decided in lib/track.ts — real closes when a vendor is
 * configured, a centred synthetic series otherwise — so this only draws.
 */
export function TrackChart({ book, track }: { book: { holdings: Holding[] }; track: TrackResult }) {
  const { book: bs, index: ss, n: N, bookEnd: bEnd, indexEnd: sEnd } = track;
  // Drawn only when it was measured over the very same window.
  const sec = track.sector && track.sector.length === N ? track.sector : null;
  const secEnd = track.sectorEnd ?? 0;
  const all = sec ? bs.concat(ss, sec) : bs.concat(ss);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const yOf = (v: number) => PT + (1 - (v - lo) / (hi - lo || 1)) * (H - PT - PB);
  const path = (a: number[]) =>
    a
      .map((v, i) => (i ? "L" : "M") + (PL + (i / (N - 1)) * (W - PL - PR)).toFixed(1) + " " + yOf(v).toFixed(1))
      .join(" ");
  const area = `${path(bs)} L ${W - PR} ${H - PB} L ${PL} ${H - PB} Z`;

  return (
    <>
      <Bar holdings={book.holdings} size="sm" />
      <svg
        className="chart"
        style={{ marginTop: 22 }}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          `Portfolio performance against the index over ${N} sessions. Portfolio ${bEnd.toFixed(1)}%, ` +
          `index ${sEnd.toFixed(1)}%.` +
          (sec ? ` Sector ${track.sectorTicker} ${secEnd.toFixed(1)}%.` : "")
        }
      >
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#AEB6FF" stopOpacity=".24" />
            <stop offset="100%" stopColor="#AEB6FF" stopOpacity="0" />
          </linearGradient>
          <filter id="gl">
            <feGaussianBlur stdDeviation="3.5" result="bb" />
            <feMerge>
              <feMergeNode in="bb" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <line
          x1={PL}
          y1={yOf(0).toFixed(1)}
          x2={W - PR}
          y2={yOf(0).toFixed(1)}
          stroke="rgba(255,255,255,.11)"
          strokeDasharray="3 5"
        />
        <path d={area} fill="url(#ag)" />
        <path d={path(ss)} fill="none" stroke="rgba(255,255,255,.30)" strokeWidth="1.7" />
        {sec ? (
          // Dashed, so at a glance it reads as the other yardstick rather than
          // as a second book.
          <path
            d={path(sec)}
            fill="none"
            stroke="rgba(174,182,255,.45)"
            strokeWidth="1.6"
            strokeDasharray="5 4"
          />
        ) : null}
        <path d={path(bs)} fill="none" stroke="#AEB6FF" strokeWidth="2.3" filter="url(#gl)" />
        {/* "Yours" rather than "Portfolio": the label sits in 54 units of gutter
            and the longer word clips. It also pairs better with SPY beneath it
            — what this reads as is yours against the index. */}
        <text className="endlab" x={W - PR + 10} y={(yOf(bEnd) + 4).toFixed(1)} fill="#AEB6FF">
          Yours
        </text>
        <text className="endlab" x={W - PR + 10} y={(yOf(sEnd) + 4).toFixed(1)} fill="rgba(255,255,255,.45)">
          SPY
        </text>
        {sec ? (
          <text
            className="endlab"
            x={W - PR + 10}
            y={(yOf(secEnd) + 4).toFixed(1)}
            fill="rgba(174,182,255,.6)"
          >
            {track.sectorTicker}
          </text>
        ) : null}
        <text className="axis" x={PL} y={H - 6}>
          Stated
        </text>
        <text className="axis" x={W - PR} y={H - 6} textAnchor="end">
          {N} sessions
        </text>
      </svg>
    </>
  );
}
