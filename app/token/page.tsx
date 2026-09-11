import type { Metadata } from "next";
import { twitterCard } from "@/lib/twitter-card";

import { pageOg } from "@/lib/og-pages";

import { TelegramIcon, XIcon } from "@/components/icons";
import { CopyAddress } from "@/components/CopyAddress";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `$${SITE.token.ticker}`,
  // The search result and the link preview are where somebody arrives from a
  // scammer's reply, so they carry the same sentence the page does.
  description: SITE.token.contractAddress
    ? `Tokenomics for $${SITE.token.ticker} and the one official contract address. The research tool is free and stays free. Any address that does not match the one on this page is fake.`
    : `Tokenomics for $${SITE.token.ticker}, published before launch. The research tool is free and stays free. The token is not deployed and any contract address circulating today is fake.`,
  alternates: { canonical: "/token" },
  openGraph: {
    url: "/token",
    title: `$${SITE.token.ticker} — ${SITE.name}`,
    description: SITE.token.contractAddress
      ? `The one official contract address, the stated utilities, and the anti-scam rules.`
      : `Fixed supply, stated utilities, and the anti-scam rules — published before anything is deployed.`,
    images: [{ url: pageOg("token"), width: 1200, height: 630 }],
  },
  twitter: twitterCard(pageOg("token")),
};

/**
 * HANDOFF.md §9. The anti-scam language on this page is load-bearing: the
 * highest-risk window for this project is right now, before the contract
 * exists, because that is when scammers publish fake addresses. Do not soften
 * it.
 *
 * The prototype's version of this page threw a ReferenceError on two undefined
 * SVG constants and rendered blank; the icons are components now.
 */
const UTILITIES: [string, string][] = [
  [
    "Higher generation limits",
    "Unlimited portfolios per day and access to deeper matching once the model layer ships.",
  ],
  [
    "Publish and fork",
    "Put a portfolio on a public page others can follow or fork under their own premise.",
  ],
  [
    "Creator rewards",
    "A share of protocol fees routed to the authors of portfolios other people actually follow.",
  ],
  ["Reduced platform fees", "Lower cost on the settlement layer once execution exists."],
  [
    "Governance",
    "A vote on which themes enter the universe and how conviction scores are reviewed.",
  ],
  ["Staking tiers", "Lock for access tiers rather than paying a subscription."],
];

const STEPS: [string, string][] = [
  [
    "Get an EVM wallet",
    "Any wallet that supports the chain works. MetaMask, Rabby and Coinbase Wallet are all fine.",
  ],
  [
    `Add ${SITE.token.chain}`,
    "Add the network from your wallet's settings, or use the Connect button in the header once the pool is live.",
  ],
  [
    "Fund the wallet",
    "Bridge or deposit the pairing asset. You will need a small amount extra for gas.",
  ],
  [
    "Verify the contract",
    "Copy the address only from this page or the official X account. Never from a reply, a DM or a search result.",
  ],
  ["Swap", "Enter an amount, check the price impact, and confirm in your wallet."],
];

export default function TokenPage() {
  const { ticker, supply, chainShort, contractAddress } = SITE.token;

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Token</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "18ch" }}>
        ${ticker}
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        The research tool is free and stays free. The token exists for the parts that cost money to
        run — the model layer, the published portfolios, and eventually settlement.
      </p>

      <div className="stats rv" style={{ marginTop: "clamp(26px,3.5vw,44px)" }}>
        <div>
          <div className="sn">{ticker}</div>
          <div className="sl">Ticker</div>
        </div>
        <div>
          <div className="sn">{supply}</div>
          <div className="sl">Total supply, fixed</div>
        </div>
        <div>
          <div className="sn" style={{ fontSize: 22, paddingTop: 5 }}>
            {chainShort}
          </div>
          <div className="sl">Chain</div>
        </div>
        <div>
          <div className={contractAddress ? "sn" : "sn wn"} style={{ fontSize: 22, paddingTop: 5 }}>
            {contractAddress ? "Live" : "Not live"}
          </div>
          <div className="sl">Status</div>
        </div>
      </div>

      <div className="cell rv" style={{ marginTop: 12, padding: "clamp(20px,2.6vw,28px)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <h3>Contract address</h3>
          <span className={contractAddress ? "pill pon" : "soon"}>
            {contractAddress ? "Live" : "Coming soon"}
          </span>
        </div>
        <p className="p" style={{ fontSize: 13, marginTop: 8, maxWidth: "56ch" }}>
          {contractAddress
            ? `This page and the official X account carry the same address, published at the same
               moment and nowhere else first. Check it character by character against this page
               before you trade — including the last four.`
            : `Nothing is tradeable yet. When the pool opens, the address appears here and on the
               official X account at the same moment — and nowhere else first.`}
        </p>
        {contractAddress ? (
          <CopyAddress address={contractAddress} />
        ) : (
          <div className="addrbox" style={{ marginTop: 14 }}>
            <code>0x0000…0000 — not deployed</code>
            <button
              className="copyb"
              disabled
              style={{ opacity: 0.4, cursor: "not-allowed" }}
              aria-disabled="true"
            >
              Copy
            </button>
          </div>
        )}
        <p className="notice warn" style={{ marginTop: 16 }}>
          Any address that does not match the one on this page is fake, including ones posted in
          replies, DMs, search results and lookalike sites. There is no presale, no whitelist, no
          private round and no team wallet taking deposits. Nobody from this project will ever
          message you first.
        </p>
      </div>

      <h2 className="rv" style={{ marginTop: "clamp(46px,6vw,84px)", maxWidth: "20ch" }}>
        What the token is for.
      </h2>
      <p className="sub rv" style={{ marginTop: 14 }}>
        Written down before launch so it can be held against us afterwards.
      </p>
      <div className="bento rv" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
        {UTILITIES.map(([head, body]) => (
          <div className="cell c2" key={head}>
            <h3 style={{ fontSize: 15 }}>{head}</h3>
            <p className="p" style={{ fontSize: 13, marginTop: 7 }}>
              {body}
            </p>
          </div>
        ))}
      </div>
      <p className="notice rv" style={{ marginTop: 20 }}>
        None of these are live. Composing portfolios, reading the universe, tracking against the index
        and sharing a portfolio address are free today and stay free — the token gates the expensive
        layer, not the research.
      </p>

      <h2 className="rv" style={{ marginTop: "clamp(46px,6vw,84px)", maxWidth: "20ch" }}>
        How to buy, when it opens.
      </h2>
      <div className="cell rv" style={{ marginTop: 20, padding: "clamp(20px,2.6vw,28px)" }}>
        {STEPS.map(([head, body], i) => (
          <div className="buystep" key={head}>
            <span className="buyn">{i + 1}</span>
            <span>
              <span className="hn">{head}</span>
              <div className="hy" style={{ fontSize: 12.5 }}>
                {body}
              </div>
            </span>
          </div>
        ))}
      </div>

      <div className="cta rv" style={{ marginTop: "clamp(40px,5vw,70px)" }}>
        <h2 style={{ maxWidth: "18ch", marginInline: "auto" }}>
          {SITE.x || SITE.telegram
            ? "The address drops in the channels first."
            : "The address will appear on this domain first."}
        </h2>
        <p className="sub" style={{ margin: "16px auto 0", textAlign: "center", maxWidth: "42ch" }}>
          {SITE.x || SITE.telegram
            ? "Two official channels, and no others. Anyone contacting you from anywhere else is not us."
            : "There are no channels yet. Until they are announced on this domain, every account or group claiming to be this project is not — including any that posts an address."}
        </p>
        {SITE.x || SITE.telegram ? (
          <div className="socbig" style={{ justifyContent: "center" }}>
            {SITE.x ? (
              <a href={SITE.x} target="_blank" rel="noopener">
                <XIcon />
                Follow on X
              </a>
            ) : null}
            {SITE.telegram ? (
              <a href={SITE.telegram} target="_blank" rel="noopener">
                <TelegramIcon />
                Join Telegram
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
