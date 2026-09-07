import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { buildBook } from "@/lib/generator";
import { seedOf } from "@/lib/hash";
import { isPageCardId, PAGE_CARDS, type PageCard } from "@/lib/og-pages";
import { normalizePremise } from "@/lib/premise";
import { parseDrop } from "@/lib/routes";
import { FEATURED, SITE } from "@/lib/site";

/**
 * Share images. HANDOFF.md §6.2 — "the single biggest growth lever, and the
 * thing the competitor got wrong."
 *
 * Two modes:
 *   ?p=<premise>  a book card: the allocation bar, the theme, and why the lead
 *                 position leads. The premise is the reader's own text.
 *   ?page=<id>    a page card, from the fixed allowlist in lib/og-pages.ts.
 *
 * There is deliberately no free-text mode. Accepting arbitrary title and body
 * from the query string would let anyone mint a Igitur-branded image saying
 * anything at all.
 *
 * Both modes are deterministic, so the rendered PNG is cached in process and
 * served with an immutable Cache-Control for whatever CDN sits in front.
 */

export const runtime = "nodejs";

const W = 1200;
const H = 630;

const BG = "#0A0A0B";
const FG = "#FAFAFA";
const FG2 = "#9E9EA6";
const FG3 = "#8A8A92";
const AC = "#7C8CFF";
const BD = "rgba(255,255,255,0.115)";

/**
 * Rendering a card costs roughly half a second of CPU, and every distinct
 * premise is a fresh render. Keep the recent ones in memory so a book being
 * shared — the whole point of this route — is rendered once, not once per
 * reader. Bounded, and evicted oldest-first.
 */
const CACHE_LIMIT = 256;
const cache = new Map<string, Uint8Array>();

function remember(key: string, png: Uint8Array) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, png);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function png(body: Uint8Array, hash: string, hit: boolean) {
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, immutable, no-transform, max-age=31536000",
      "x-premise-hash": hash,
      "x-og-cache": hit ? "hit" : "miss",
    },
  });
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const pageId = params.get("page") ?? "";

  // ---- Page card -----------------------------------------------------------
  if (pageId) {
    if (!isPageCardId(pageId)) {
      return new Response("Unknown page card", { status: 404 });
    }
    const key = `page:${pageId}`;
    const hit = cache.get(key);
    if (hit) return png(hit, pageId, true);

    // Widen off the `as const` literal so the optional kicker is visible here.
    const card: PageCard = PAGE_CARDS[pageId];
    // The home card carries the signature bar; the rest stay typographic.
    const featured = pageId === "home" ? buildBook(FEATURED) : null;

    const image = new ImageResponse(
      (
        <div style={shell}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Wordmark />
            {card.kicker ? (
              <div style={{ display: "flex", fontSize: 24, color: AC, marginTop: 34 }}>
                {card.kicker}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                fontSize: card.title.length > 40 ? 58 : 68,
                color: FG,
                marginTop: card.kicker ? 14 : 34,
                lineHeight: 1.14,
                letterSpacing: "-0.03em",
              }}
            >
              {card.title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 27,
                color: FG2,
                marginTop: 22,
                lineHeight: 1.4,
                maxWidth: 940,
              }}
            >
              {card.body}
            </div>
          </div>

          {featured?.ok ? (
            <MiniBar holdings={featured.holdings} caption="Widths are weights · total 100%" />
          ) : (
            <div style={{ display: "flex", fontSize: 22, color: FG3 }}>
              {SITE.url.replace(/^https?:\/\//, "")}
            </div>
          )}
        </div>
      ),
      { width: W, height: H }
    );
    const buf = new Uint8Array(await image.arrayBuffer());
    remember(key, buf);
    return png(buf, pageId, false);
  }

  // ---- Book card -----------------------------------------------------------
  const premise = normalizePremise(params.get("p") ?? "");
  const drop = parseDrop(params.get("x") ?? undefined);
  const key = `book:${premise}|${drop.join(",")}`;
  const hit = cache.get(key);
  const hash = premise ? seedOf(premise).toString(36) : "none";
  if (hit) return png(hit, hash, true);

  const book = buildBook(premise, drop);

  // A refusal gets a card too: a shared no-match link should not look broken.
  if (!book.ok) {
    const image = new ImageResponse(
      (
        <div style={shell}>
          <Wordmark />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, color: FG3 }}>No match</div>
            <div
              style={{
                display: "flex",
                fontSize: 56,
                color: FG,
                marginTop: 16,
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
              }}
            >
              No theme in this universe carries that claim.
            </div>
            <div style={{ display: "flex", fontSize: 26, color: FG2, marginTop: 22, lineHeight: 1.4 }}>
              Igitur stops rather than assembling a plausible-looking portfolio out of whatever was
              nearest.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: FG3 }}>
            {SITE.url.replace(/^https?:\/\//, "")}
          </div>
        </div>
      ),
      { width: W, height: H }
    );
    const buf = new Uint8Array(await image.arrayBuffer());
    remember(key, buf);
    return png(buf, hash, false);
  }

  const b = book;
  const premiseText = b.premise.length > 150 ? b.premise.slice(0, 149).trimEnd() + "…" : b.premise;

  const image = new ImageResponse(
    (
      <div style={{ ...shell, padding: 64 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Wordmark />
          <div
            style={{
              display: "flex",
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

        <MiniBar
          holdings={b.holdings}
          caption="Widths are weights · total 100%"
          lead={`Led by ${b.holdings[0].n} at ${b.holdings[0].pct}%`}
        />
      </div>
    ),
    { width: W, height: H }
  );
  const buf = new Uint8Array(await image.arrayBuffer());
  remember(key, buf);
  return png(buf, hash, false);
}

const shell: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  background: BG,
  padding: 72,
  fontFamily: "sans-serif",
};

/** The allocation bar. Colour carries information: white for the lead,
 *  descending white for conviction order, indigo for ballast. */
function MiniBar({
  holdings,
  caption,
  lead,
}: {
  holdings: { t: string; pct: number; lead?: boolean; ballast?: boolean }[];
  caption: string;
  lead?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", width: "100%", height: 92, borderRadius: 14, overflow: "hidden" }}>
        {holdings.map((h, i) => {
          const fill = h.lead
            ? "#FFFFFF"
            : h.ballast
              ? AC
              : `rgba(255,255,255,${Math.max(0.14, 0.52 - i * 0.075).toFixed(3)})`;
          const text = h.lead || h.ballast ? "#0A0A0B" : FG;
          return (
            <div
              key={h.t}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                width: `${h.pct}%`,
                background: fill,
                padding: "0 14px",
                borderRight: "1px solid rgba(10,10,11,0.5)",
                overflow: "hidden",
              }}
            >
              {h.pct >= 7 ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 22, color: text, fontWeight: 700 }}>{h.t}</div>
                  <div style={{ fontSize: 18, color: text, opacity: 0.75 }}>{`${h.pct}%`}</div>
                </div>
              ) : null}
            </div>
          );
        })}
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
        <div style={{ display: "flex" }}>{lead ?? ""}</div>
        <div style={{ display: "flex" }}>{caption}</div>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {/* The mark, built from flex boxes: Satori renders a subset of SVG, and
          three rounded rectangles need none of it. Proportions mirror
          brand/igitur-mark.svg — the second premise is 0.70 of the first. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 34 }}>
        <div style={{ display: "flex", gap: 2.5, height: 7 }}>
          <div style={{ display: "flex", width: 17.6, background: "rgba(255,255,255,.36)", borderRadius: 3.5 }} />
          <div style={{ display: "flex", width: 12.3, background: AC, borderRadius: 3.5 }} />
        </div>
        <div style={{ display: "flex", width: 34, height: 9.7, background: FG, borderRadius: 4.85 }} />
      </div>
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
