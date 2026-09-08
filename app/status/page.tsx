import type { Metadata } from "next";
import { twitterCard } from "@/lib/twitter-card";

import { isLive, marketIsReal, providerName, vendorError } from "@/lib/market";

import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";

/**
 * Market figures on this page are fetched on the server, and the vendor key is
 * set at runtime rather than at build time. Without this the page would be
 * baked once — during a build that had no key — and would go on serving
 * synthetic numbers for ever, however the server was later configured.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "What is built",
  description:
    "An honest list of what works in Igitur today and what does not. No dates are attached to work that is not done.",
  alternates: { canonical: "/status" },
  openGraph: {
    url: "/status",
    title: `What is built — ${SITE.name}`,
    description:
      "What works today and what does not. A line moves to the first list when it ships, and not before.",
    images: [{ url: pageOg("status"), width: 1200, height: 630 }],
  },
  twitter: twitterCard(pageOg("status")),
};

/**
 * HANDOFF.md §14: keep these published, and move a line only when it ships.
 *
 * Two lines moved in the production build: server-rendered routes and the
 * per-book preview image. Both were listed as impossible inside a single HTML
 * file, and both are now live — see §6.1 and §6.2.
 */
const ALWAYS_LIVE = [
  "Compose a book from any premise",
  "Negative keywords to stop cross-sector mismatches",
  "Written case for and against, every time",
  "Remove a holding and reweight the book",
  "Session history of everything you built",
  "Prices and market caps on every holding",
  "Filter the universe and the trending table",
  "A shareable address per book, no account",
  "Server-rendered routes with a canonical URL per page",
  "A generated preview image per book, and per page",
  "Share a book straight to X",
  "Performance against the index, honestly centred",
  "A dated public record of any claim you choose to commit",
  "A permanent page per committed claim, measured from the server's date",
  "Published methodology with its own weak points",
  "Wallet connection for any EVM wallet",
  "Published tokenomics ahead of any launch",
];

const ALWAYS_MISSING = [
  "A language model reading the premise",
  "Reading filings and news at generation time",
  "Conviction scores tied to disclosed segment revenue",
  "Following and forking other people's books",
  "Session history that survives a page refresh — only a committed claim persists",
  "Placing an order through a broker",
  "The token contract — not deployed",
  "Every utility listed on the token page",
];

export default async function StatusPage() {
  // The market-data line moves by itself. Writing it by hand is how a status
  // page drifts from the thing it describes.
  // Ask the vendor rather than trusting the configuration: a key that is set
  // but rejected leaves every figure synthetic, and this page of all pages must
  // not be the one that gets that wrong.
  const live = await marketIsReal();
  const rejected = isLive() && !live;
  const LIVE = live
    ? [`Live market data from ${providerName()}`, ...ALWAYS_LIVE]
    : ALWAYS_LIVE;
  const NOT_BUILT = live
    ? ALWAYS_MISSING
    : ["Live market data instead of synthetic figures", ...ALWAYS_MISSING];

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Status</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "16ch" }}>
        What is built, and what is not.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        No dates are attached to work that is not done. A line moves from the second list to the
        first when it ships, and not before.
      </p>
      <div className="bento rv">
        <div className="cell c3">
          <h3 style={{ color: "#fff" }}>Working now</h3>
          <div style={{ marginTop: 12 }}>
            {LIVE.map((s) => (
              <div className="kv" key={s}>
                <span className="kv-k">{s}</span>
                <span className="kv-v">
                  <span className="pill pon">Live</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="cell c3">
          <h3 className="ac">Not built</h3>
          <div style={{ marginTop: 12 }}>
            {NOT_BUILT.map((s) => (
              <div className="kv" key={s}>
                <span className="kv-k">{s}</span>
                <span className="kv-v">
                  <span className="pill poff">Not built</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="notice rv" style={{ marginTop: 26 }}>
        Two lines moved across in this build. Search-engine routing and per-book preview images both
        needed a server — every page used to live behind a hash, which crawlers read as a single
        page, and a preview image has to be generated per book. Both now ship: every page has its
        own URL and its own canonical tag, and every book renders its own image.
      </p>
      <p className="notice warn rv" style={{ marginTop: 14 }}>
        {live
          ? `Market data comes from ${providerName()}. Any figure the vendor cannot cover falls back
             to a generated one and is flagged individually, rather than the whole page claiming to
             be real. Tracking pages stay out of the sitemap until their history has been checked
             against a second source.`
          : rejected
            ? `A vendor key is configured but ${providerName()} is not answering, so every figure on
               the site is synthetic and flagged as such. The last thing the vendor said was:
               ${vendorError() ?? "no response"}. A 401 or 403 means the key is wrong; a 402 means
               the plan does not include batch quotes; a 429 means the daily quota is spent.`
            : `The market data is still synthetic. Prices, moves, market caps and the whole return
               series are generated from the ticker text and reflect nothing. The vendor layer is
               built and waiting on a key — set MARKET_API_KEY and this line moves by itself. The
               tracking pages are deliberately kept out of search engines and out of the sitemap
               while this is true; a fabricated return has no business in a search result.`}
      </p>
      <p className="notice rv" style={{ marginTop: 14 }}>
        Order routing is the hardest line on this page. It needs a broker relationship and custody,
        not a front end. Until that exists this tool produces research and nothing else — and says
        so on every page.
      </p>
      <p className="notice warn rv" style={{ marginTop: 14 }}>
        The token is not deployed. Every utility on the token page is a stated intention, not a
        shipped feature, and the contract address field reads <span className="wn">Coming soon</span>{" "}
        because there is nothing to put in it. Any address circulating for this project today is
        fake.
      </p>
    </section>
  );
}
