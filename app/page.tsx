import type { Metadata } from "next";
import Link from "next/link";
import { twitterCard } from "@/lib/twitter-card";

import { Bar, BarFoot } from "@/components/Bar";
import { Holdings } from "@/components/Holdings";
import { HeroPrompt } from "@/components/HeroPrompt";
import { TelegramIcon, XIcon } from "@/components/icons";
import { buildBook } from "@/lib/generator";
import { getQuotes } from "@/lib/market";
import { pageOg } from "@/lib/og-pages";
import { FEATURED, HOST, SITE } from "@/lib/site";
import { NAMES, THEMES } from "@/lib/universe";

/**
 * Market figures on this page are fetched on the server, and the vendor key is
 * set at runtime rather than at build time. Without this the page would be
 * baked once — during a build that had no key — and would go on serving
 * synthetic numbers for ever, however the server was later configured.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [{ url: pageOg("home"), width: 1200, height: 630, alt: SITE.tagline }],
  },
  twitter: twitterCard(pageOg("home")),
};

const COMPARISON: [string, string, string][] = [
  ["What you start from", "A ticker someone posted", "A claim you can state"],
  ["How it gets sized", "Whatever felt right", "Weighted to conviction"],
  ["What you end up with", "Unrelated positions", "One coherent thesis"],
  ["Why you own each thing", "You can't quite say", "Written, per holding"],
  ["The other side of the trade", "You never looked", "Shown next to the case for"],
  ["How the numbers were set", "Nobody says", "Published methodology"],
  ["When it doesn't know", "It answers anyway", "It stops and says so"],
];

export default async function Home() {
  const b = buildBook(FEATURED);
  if (!b.ok) throw new Error("FEATURED premise must build a book");
  const quotes = await getQuotes(b.holdings.slice(0, 3).map((h) => h.t));

  return (
    <>
      <div className="shell hero-wrap">
        <span className="badge rv">
          <b>New</b> {NAMES} names across {THEMES.length} themes
        </span>
        <h1 className="hero rv" style={{ marginTop: 24 }}>
          Write what you believe.
          <br />
          <span>See what it holds.</span>
        </h1>
        <p className="sub rv" style={{ margin: "24px auto 0", textAlign: "center" }}>
          One sentence about the next decade goes in. A weighted portfolio comes out — and every
          single weight carries the reason it earned its size.
        </p>
        <div className="hero-cta rv">
          <Link className="b1 lg" href="/compose">
            Build your first book
          </Link>
          <a className="b2 lg" href="#how">
            See how it works
          </a>
        </div>
        <div className="window rv">
          <div className="wbar">
            <div className="wdots">
              <i />
              <i />
              <i />
            </div>
            <div className="wurl">{HOST}/b/compute-is-the-binding-constraint</div>
          </div>
          <div className="wbody">
            <HeroPrompt text="that compute is the binding constraint on AI, not model design.">
              <div className="meta">
                <span className="tagp on">{b.theme.name}</span>
                <span className="tagp">{b.risk}</span>
                <span className="tagp">{b.horizon}</span>
                <span className="tagp">{b.holdings.length} holdings</span>
                <span className="tagp">Confidence {b.confidence}%</span>
              </div>
              <Bar holdings={b.holdings} />
              <BarFoot />
            </HeroPrompt>
          </div>
        </div>
      </div>

      <section style={{ paddingBlock: "clamp(38px,5vw,64px)" }}>
        <p
          className="shell"
          style={{ textAlign: "center", fontSize: 12.5, color: "var(--fg-4)", marginBottom: 26 }}
        >
          {THEMES.length} themes, each with a written thesis and both sides of the argument
        </p>
        <div className="strip">
          <div className="track">
            {THEMES.concat(THEMES).map((t, i) => (
              <span key={t.id + i}>{t.name}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="shell">
        <div className="hr" />
      </div>

      <section id="features" className="shell">
        <span className="kick rv">Features</span>
        <h2 className="rv" style={{ marginTop: 12, maxWidth: "18ch" }}>
          Research you can actually check.
        </h2>
        <p className="sub rv" style={{ marginTop: 16 }}>
          Most tools hand you a list. Igitur hands you a list, the reasoning behind every line,
          the argument that would break it, and a page explaining exactly how the weights were set.
        </p>
        <div className="bento">
          <div className="cell c4 rv">
            <h3>A reason on every holding</h3>
            <p className="p">
              No weight appears without a sentence explaining what it is doing there. Remove any
              line and the rest reweight in front of you.
            </p>
            <div style={{ marginTop: 16 }}>
              <Holdings holdings={b.holdings.slice(0, 3)} quotes={quotes} />
            </div>
          </div>
          <div className="cell c2 rv">
            <h3>Both sides, every time</h3>
            <p className="p" style={{ marginBottom: 14 }}>
              A tool that only argues one way is a sales page.
            </p>
            <div className="sbox sfor">
              <div className="slab">The case for</div>
              <div className="stx">
                Frontier training runs are gated by physical supply, not ideas.
              </div>
            </div>
            <div className="sbox sag" style={{ marginTop: 10 }}>
              <div className="slab">The case against</div>
              <div className="stx">
                Every capex supercycle in semiconductors has ended in a glut.
              </div>
            </div>
          </div>
          <div className="cell c2 rv">
            <h3>Weighted by conviction</h3>
            <p className="p">
              Not equal weight. Not market cap. Size follows how directly a name carries your
              claim, and the formula is published.
            </p>
            <div
              style={{ display: "flex", gap: 5, height: 60, alignItems: "flex-end", marginTop: 18 }}
            >
              {[
                ["100%", "linear-gradient(180deg,#fff,#9AA3F0)"],
                ["82%", "rgba(255,255,255,.22)"],
                ["68%", "rgba(255,255,255,.17)"],
                ["56%", "rgba(255,255,255,.13)"],
                ["46%", "rgba(255,255,255,.1)"],
                ["40%", "rgba(124,140,255,.42)"],
              ].map(([h, bg], i) => (
                <div key={i} style={{ flex: 1, height: h, borderRadius: 6, background: bg }} />
              ))}
            </div>
          </div>
          <div className="cell c2 rv">
            <h3>Every book has an address</h3>
            <p className="p">
              Send it to anyone. They open the exact same book, weight for weight. No account,
              nothing stored.
            </p>
            <div className="urlbox" style={{ marginTop: 18 }}>
              <code>{HOST}/b/compute-is-the…</code>
              <span className="copyb">Copy</span>
            </div>
          </div>
          <div className="cell c2 rv">
            <h3>Honestly benchmarked</h3>
            <p className="p">
              The index is shown whether or not it flatters the book — and plenty of books lose to
              it.
            </p>
            <svg
              viewBox="0 0 240 72"
              style={{ width: "100%", height: 72, marginTop: 16, overflow: "visible" }}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#AEB6FF" stopOpacity=".22" />
                  <stop offset="100%" stopColor="#AEB6FF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 46 L34 52 L62 40 L92 55 L122 44 L150 58 L182 50 L214 62 L240 56 L240 72 L0 72 Z"
                fill="url(#g1)"
              />
              <path
                d="M0 58 L34 55 L62 54 L92 50 L122 48 L150 44 L182 41 L214 37 L240 34"
                fill="none"
                stroke="rgba(255,255,255,.34)"
                strokeWidth="1.6"
              />
              <path
                d="M0 46 L34 52 L62 40 L92 55 L122 44 L150 58 L182 50 L214 62 L240 56"
                fill="none"
                stroke="#AEB6FF"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div
            className="cell c6 rv"
            style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}
          >
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3>It tells you when it doesn&rsquo;t know</h3>
              <p className="p" style={{ marginTop: 8 }}>
                Write a premise outside the universe and Igitur stops, says so, and shows you what
                it does cover — instead of assembling a plausible-looking portfolio out of whatever
                was nearest. That refusal is the most important feature on this page.
              </p>
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="sbox" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: "var(--fg-4)", marginBottom: 8 }}>
                  I believe that my cat will become mayor
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ac-2)" }}>
                  No theme in this universe carries that claim.
                </div>
                <div className="stx" style={{ marginTop: 7 }}>
                  Nothing was generated. Pick a written thesis, or name a specific constraint,
                  industry or resource.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="shell">
        <span className="kick rv">How it works</span>
        <h2 className="rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
          Three steps, no spreadsheet.
        </h2>
        <div className="steps">
          <div className="step rv">
            <div className="stepn">1</div>
            <h3 style={{ marginTop: 16 }}>Read the claim</h3>
            <p className="p" style={{ marginTop: 8 }}>
              Your sentence is matched against {THEMES.length} written theses, with negative terms
              that stop a claim landing in the wrong sector.
            </p>
          </div>
          <div className="step rv">
            <div className="stepn">2</div>
            <h3 style={{ marginTop: 16 }}>Assign the weight</h3>
            <p className="p" style={{ marginTop: 8 }}>
              Each candidate carries a published conviction score. Size follows that score through a
              formula you can read, capped so no name dominates.
            </p>
          </div>
          <div className="step rv">
            <div className="stepn">3</div>
            <h3 style={{ marginTop: 16 }}>Show the working</h3>
            <p className="p" style={{ marginTop: 8 }}>
              Every holding arrives with its reason, its role, its price, and the case that would
              break it. Edit anything and the book reweights.
            </p>
          </div>
        </div>
        <div className="stats rv" style={{ marginTop: 12 }}>
          <div>
            <div className="sn">{NAMES}</div>
            <div className="sl">names in the universe</div>
          </div>
          <div>
            <div className="sn">{THEMES.length}</div>
            <div className="sl">themes with a written thesis</div>
          </div>
          <div>
            <div className="sn">5–8</div>
            <div className="sl">holdings per book</div>
          </div>
          <div>
            <div className="sn">100%</div>
            <div className="sl">of weights carry a reason</div>
          </div>
        </div>
      </section>

      <section id="compare" className="shell">
        <span className="kick rv">The difference</span>
        <h2 className="rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
          Two ways to own an idea.
        </h2>
        <div className="cmp rv">
          <div className="crow head">
            <div />
            <div>The usual way</div>
            <div>With Igitur</div>
          </div>
          {COMPARISON.map((r) => (
            <div className="crow" key={r[0]}>
              <div>{r[0]}</div>
              <div>{r[1]}</div>
              <div>{r[2]}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="community" className="shell">
        <div className="g-none" />
        <span className="kick rv">Community</span>
        <h2 className="rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
          The tool is free. The token is for the expensive part.
        </h2>
        <div className="bento rv">
          <div className="cell c3">
            <h3>${SITE.token.ticker}</h3>
            <p className="p" style={{ marginTop: 8 }}>
              Fixed supply of {SITE.token.supply === "1B" ? "1 billion" : SITE.token.supply} on{" "}
              {SITE.token.chain}. It gates higher generation limits, published books, creator
              rewards and governance — not the research, which stays free.
            </p>
            <div className="addrbox" style={{ marginTop: 16 }}>
              <code>Contract address</code>
              <span className="soon">Coming soon</span>
            </div>
            <Link className="b2" style={{ marginTop: 14 }} href="/token">
              Read the tokenomics
            </Link>
          </div>
          <div className="cell c3">
            <h3>{SITE.x || SITE.telegram ? "Two official channels" : "No official channels yet"}</h3>
            {SITE.x || SITE.telegram ? (
              <>
                <p className="p" style={{ marginTop: 8 }}>
                  The contract address appears on this site and on X at the same moment, and nowhere
                  else first. There is no presale, no whitelist and no team wallet taking deposits.
                  Nobody from this project will message you first.
                </p>
                <div className="socbig">
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
              </>
            ) : (
            <p className="p" style={{ marginTop: 8 }}>
              There are no official channels yet. Until they are announced here, on this domain,
              every account, group or DM claiming to be this project is not — including any that
              posts a contract address. There is no presale, no whitelist and no team wallet taking
              deposits, and nobody from this project will message you first.
            </p>
            )}
          </div>
        </div>
      </section>

      <section className="shell">
        <div className="cta rv">
          <h2 style={{ maxWidth: "16ch", marginInline: "auto" }}>
            You already have a view. Go hold it properly.
          </h2>
          <p
            className="sub"
            style={{ margin: "18px auto 0", textAlign: "center", maxWidth: "44ch" }}
          >
            Free, unlimited, no account and no wallet needed. Nothing here places an order — taking
            a position stays your decision.
          </p>
          <div className="hero-cta" style={{ marginTop: 28 }}>
            <Link className="b1 lg" href="/compose">
              Build your first book
            </Link>
            <Link className="b2 lg" href="/method">
              Read the methodology
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
