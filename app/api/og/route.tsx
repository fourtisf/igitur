import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { buildBook } from "@/lib/generator";
import { seedOf } from "@/lib/hash";
import { parseDrop } from "@/lib/routes";
import { SITE } from "@/lib/site";

/**
 * Dynamic OG image per book. HANDOFF.md §6.2 — "the single biggest growth
 * lever, and the thing the competitor got wrong. If you ship one thing from
 * this section, ship this."
 *
 * Sharing a book link used to produce a blank card. Now it produces the
 * allocation bar at 1200×630 with the premise, the theme, risk, horizon and
 * the wordmark.
 *
 * Deterministic in, deterministic out: the same premise always renders the same
 * image, so it is cached hard and keyed by the premise hash.
 */

export const runtime = "nodejs";

const W = 1200;
const H = 630;

const BG = "#0A0A0B";
const FG = "#FAFAFA";
const FG2 = "#9E9EA6";
const FG3 = "#6B6B74";
const AC = "#7C8CFF";
const BD = "rgba(255,255,255,0.115)";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const premise = params.get("p") ?? "";
  const drop = parseDrop(params.get("x") ?? undefined);
  const book = buildBook(premise, drop);

  // A refusal gets a card too — it is a real outcome, and a link to one should
  // not look broken.
  if (!book.ok) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: BG,
            padding: 72,
            fontFamily: "sans-serif",
          }}
        >
          <Wordmark />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, color: FG3 }}>No match</div>
            <div style={{ fontSize: 56, color: FG, marginTop: 16, lineHeight: 1.15 }}>
              No theme in this universe carries that claim.
            </div>
            <div style={{ fontSize: 26, color: FG2, marginTop: 22, lineHeight: 1.4 }}>
              Premise stops rather than assembling a plausible-looking portfolio out of whatever was
              nearest.
            </div>
          </div>
          <div style={{ fontSize: 22, color: FG3, display: "flex" }}>
            {SITE.url.replace(/^https?:\/\//, "")}
          </div>
        </div>
      ),
      { width: W, height: H }
    );
  }

  const b = book;
  const premiseText = b.premise.length > 150 ? b.premise.slice(0, 149).trimEnd() + "…" : b.premise;
  // The bar is the product's signature. Colour carries information: white for
  // the lead, descending white for conviction order, indigo for ballast.
  const segments = b.holdings.map((h, i) => ({
    ...h,
    fill: h.lead
      ? "#FFFFFF"
      : h.ballast
        ? AC
        : `rgba(255,255,255,${Math.max(0.14, 0.52 - i * 0.075).toFixed(3)})`,
    text: h.lead ? "#0A0A0B" : h.ballast ? "#0A0A0B" : FG,
  }));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Wordmark />
          <div
            style={{
              fontSize: premiseText.length > 90 ? 40 : 48,
              color: FG,
              marginTop: 34,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {premiseText}
          </div>
          <div style={{ display: "flex", marginTop: 26, gap: 10 }}>
            <Tag label={b.theme.name} lead />
            <Tag label={b.risk} />
            <Tag label={b.horizon} />
            <Tag label={`${b.holdings.length} holdings`} />
          </div>
        </div>

        {/* The lead holding's reason. Every weight carries one — that is the
            product, so the share card shows it rather than dead space. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 20, color: FG3, letterSpacing: "0.04em" }}>
            {`WHY ${b.holdings[0].t} LEADS`}
          </div>
          <div style={{ display: "flex", fontSize: 27, color: FG2, marginTop: 12, lineHeight: 1.35 }}>
            {b.holdings[0].why}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: "100%", height: 92, borderRadius: 14, overflow: "hidden" }}>
            {segments.map((s) => (
              <div
                key={s.t}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  width: `${s.pct}%`,
                  background: s.fill,
                  padding: "0 14px",
                  borderRight: "1px solid rgba(10,10,11,0.5)",
                  overflow: "hidden",
                }}
              >
                {s.pct >= 7 ? (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 22, color: s.text, fontWeight: 700 }}>{s.t}</div>
                    <div style={{ fontSize: 18, color: s.text, opacity: 0.75 }}>{`${s.pct}%`}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 20,
              fontSize: 20,
              color: FG3,
            }}
          >
            <div style={{ display: "flex" }}>
              {`Led by ${b.holdings[0].n} at ${b.holdings[0].pct}%`}
            </div>
            <div style={{ display: "flex" }}>Widths are weights · total 100%</div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        // Deterministic: the same premise always renders the same image.
        "Cache-Control": "public, immutable, no-transform, max-age=31536000",
        "x-premise-hash": seedOf(b.premise).toString(36),
      },
    }
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          display: "flex",
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "linear-gradient(150deg,#fff,#8F9BFF 60%,#4B57C4)",
        }}
      />
      <div style={{ fontSize: 27, color: FG, fontWeight: 600, letterSpacing: "-0.02em" }}>
        {SITE.name}
      </div>
    </div>
  );
}

function Tag({ label, lead }: { label: string; lead?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "9px 18px",
        borderRadius: 999,
        fontSize: 21,
        color: lead ? "#0A0A0B" : FG2,
        background: lead ? FG : "rgba(255,255,255,0.048)",
        border: lead ? "1px solid transparent" : `1px solid ${BD}`,
      }}
    >
      {label}
    </div>
  );
}
