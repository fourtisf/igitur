# PREMISE — Engineering Handoff

**For:** Michael (via Claude Code)
**From:** ALFA
**Prototype:** `premise.html` — single file, 1,768 lines, 130 KB, no build step, no dependencies except one Google Fonts link.
**Date:** 7 September 2026

---

## 0. Read this first

`premise.html` is a **complete, working prototype**, not a mockup. Open it in a browser and every route runs. The generator produces real output from real input. Do not rebuild the logic from scratch — port it.

Two things in the prototype are **deliberately fake and must be replaced**: all market data, and the premise-to-theme matcher. Both are flagged in the code and on the site's own `/status` and `/method` pages.

One thing is **deliberately honest and must stay that way**: the app refuses to answer when it has no good answer, and the benchmark is centred so roughly half of all books lose to the index. Do not "improve" either of these. They are the product's main differentiator against competitors like vegafinance.app, which always produces an answer and whose examples always win.

---

## 1. What the product does

A user writes one sentence stating a belief about the next decade. The app returns a **book**: a weighted portfolio of 5–8 holdings where every weight carries a written reason, plus the case for and against the underlying thesis.

Nothing places an order. It is research output only.

---

## 2. Current architecture (prototype)

Single HTML file. Hash-based router. Zero build tooling. All state in memory.

```
premise.html
├── <style>              ~700 lines — design tokens + all components
├── <nav> / <footer>     static shell, persists across routes
├── <main id="app">      swapped wholesale on every route change
└── <script>
    ├── 0. util          fnv hash, xorshift rng, esc, A() asset factory
    ├── 1. THEMES[]      26 themes, 170 asset entries, 354 keywords
    ├── 2. matching      scoreThemes() + buildBook()   ← CORE IP
    ├── 3. render        renderBar, renderHoldings, themeCells
    ├── 4. market data   synthetic, deterministic      ← REPLACE
    ├── 5. session       HISTORY[] in memory
    ├── 6. views         10 view functions returning HTML strings
    ├── 6b. wallet       EIP-1193 connect/disconnect
    └── 7. router        parseHash, render, wire
```

### Routes

| Hash | View | Notes |
|---|---|---|
| `#/` | Landing | Hero has a typing animation + bar reveal, runs once |
| `#/compose` | Composer | Autofocus, Enter submits, 26 theme cards |
| `#/b?p=<premise>&x=<dropped>` | Book result | `x` is a comma-separated list of removed tickers |
| `#/history` | Session history | Memory only, dies on refresh |
| `#/trending` | All 164 names ranked by absolute move | Filterable |
| `#/track?p=<premise>` | Performance vs index | |
| `#/universe` | Full published universe | Filterable |
| `#/method` | Methodology | Includes its own weaknesses |
| `#/token` | Tokenomics, CA "coming soon" | |
| `#/status` | Built vs not built | |
| `#/about`, `#/legal` | | |

---

## 3. THE GENERATOR — this is the core IP

Port this exactly. Every constant below was tuned and regression-tested.

### 3.1 Matching (`scoreThemes`)

Each theme has `kw` (positive keywords) and `neg` (negative keywords).

```
For each keyword k in theme.kw:
  regex = /(^|[^a-z0-9])k(e?s)?([^a-z0-9]|$)/     ← word boundary, tolerates plural
  if match AND no keyword already scored at this position:
      score += (k contains a space) ? 6 : 3
      record hit
  else if k.length >= 6 AND premise contains k as substring:
      score += 1

For each keyword k in theme.neg:
  if premise contains k:  score -= 7

score = max(0, score)
```

Sort themes by score descending. **Tie-break: the theme whose first matched keyword appears earliest in the sentence wins** (the subject usually precedes the modifier).

Four rules that exist because of bugs found in testing — do not remove them:

1. **Word-boundary matching, not substring.** Naive substring matching made the 2-letter keyword `ai` match inside the word `rails`, which sent a premise about ledgers to the compute theme.
2. **Substring credit only for keywords ≥ 6 characters.** Same reason.
3. **One credit per sentence position.** A keyword list containing both `bank` and `banks` scored the same word twice and doubled that theme's score.
4. **Negative keywords.** Without them, *"drones will replace delivery vans"* resolved to Palantir and Northrop Grumman. Only `lastmile` and `defense` currently have `neg` lists; add more as mismatches surface.

### 3.2 Building the book (`buildBook`)

```
primary   = highest-scoring theme
secondary = second theme, only if score >= max(3, primary.score * 0.55)

take 6 assets from primary  (or 5 if a secondary qualifies)
take 2 assets from secondary, with conviction × 0.70

   ↑ the 0.70 discount exists so the secondary theme can NEVER take the
     lead position. Without it, a nuclear premise mentioning "datacentre"
     came back led by NVDA instead of Cameco.

weight_i = conviction_i ^ 2.8, normalised across (1 - ballastShare)

   ↑ exponent 2.8 produces a 2–3.5× spread between the largest and
     smallest holding. At 1.0 the book is nearly equal-weighted, which
     contradicts the entire pitch.

drop any holding under 5%, then re-spread   (unreadable on the bar)
cap any holding at 27%, redistribute excess proportionally
append ballast sleeve by risk level:
    Speculative 6% | Aggressive 10% | Moderate 16% | Conservative 22%
round to 1dp, force total to exactly 100 by adjusting the largest holding
sort: risky by weight desc, ballast last
holdings[0].lead = true
```

Confidence: `min(96, 26 + distinctKeywordHits × 14 + (score > 12 ? 8 : 0))`.
Below 50 the UI shows an orange warning listing which terms actually matched. **Keep this.** It is the honest signal that the match is weak.

### 3.3 Determinism

`fnv(premise.toLowerCase().trim())` seeds everything. The same premise always produces the same book, byte for byte, on any machine. **This is what makes a shared URL work without a database.** Do not introduce randomness that breaks it.

---

## 4. REPLACE #1 — the matcher (highest value change)

The current matcher is string matching, not language understanding. It cannot infer intent, only recognise vocabulary it was given. A premise using unanticipated words is refused even when a sensible portfolio exists.

**Target:** an LLM call that reads the premise and returns structured JSON.

```
POST /api/compose
{ "premise": "drones will replace delivery vans in cities" }

→ {
    "matched": true,
    "themeId": "lastmile",
    "secondaryThemeId": "robotics" | null,
    "confidence": 0.82,
    "reasoning": "The claim is about the cost of the final delivery mile...",
    "holdings": [
      { "ticker": "UPS", "conviction": 88,
        "why": "The densest delivery network; automation lands here first." }
    ],
    "risk": "Moderate",
    "horizon": "3–5 years"
  }
```

**Non-negotiable constraints on the model call:**

- It must be allowed to return `"matched": false`. Prompt it explicitly that refusing is a correct answer. Do not let it improvise a portfolio from adjacent vocabulary — that is the exact failure this product is positioned against.
- Constrain it to the published universe. It may not invent tickers.
- Keep the weighting formula in **application code**, not in the model. The model supplies conviction scores; §3.2 turns them into weights. This keeps weights auditable and reproducible.
- Cache by `hash(premise)` so shared URLs stay deterministic and cheap.

Keep the keyword matcher as a fallback for when the API is down or rate-limited.

---

## 5. REPLACE #2 — market data

Everything numeric on `/trending`, `/track`, and the price line under each holding is generated from the ticker string. It never changes and reflects nothing.

| Function | Currently | Needs |
|---|---|---|
| `priceOf(ticker)` | hash → price band | Real last close |
| `mcapOf(ticker)` | hash → market cap | Real market cap |
| `moveFor(ticker)` | hash → fat-tailed % | Real session change |
| `sparkPath(ticker)` | random walk | Real intraday series |
| `series()` on `/track` | random walk | Real total return since stated date |

Vendors worth pricing: Polygon.io, Financial Modeling Prep, Twelve Data. All 164 tickers fit comfortably in a free or cheap tier.

**Critical — the benchmark must stay fair.** An earlier build gave the book a higher drift (0.055) than the index (0.032), which meant *every* book beat the market. That was a marketing claim baked into the code. It now draws from the premise seed and is centred on the index: **14 of 26 themes beat it, 12 lose.** With real data this resolves itself, but never reintroduce an asymmetry.

---

## 6. CANNOT be fixed in a single file — needs the server

These two are the reason a production build exists at all.

### 6.1 Real routes, not hashes

Every page currently lives behind `#/`. Search engines read the entire site as one URL. **This is the same net effect as the canonical-tag bug on vegafinance.app** — their `/constellate`, `/trending` and `/track` all canonicalise to their homepage, so none of it is indexed.

Do not repeat it:

- Server-rendered routes: `/compose`, `/b/[slug]`, `/trending`, `/track/[slug]`, `/universe`, `/method`, `/token`, `/status`, `/about`, `/legal`
- **A distinct `<link rel="canonical">` per page.** Not the homepage on every page.
- Per-page `<title>` and `<meta name="description">`
- `sitemap.xml` including one entry per theme claim
- SSR the book page so a shared link is crawlable

### 6.2 Dynamic OG image per book

The single biggest growth lever, and the thing the competitor got wrong. Sharing a book link currently produces a blank card.

Generate a PNG per book at request time (`@vercel/og` or Satori), containing:
- The premise text
- The allocation bar rendered at 1200×630
- Theme name, risk, horizon
- Wordmark

Route: `/api/og?p=<premise>`. Cache by premise hash. Reference it from `og:image` and `twitter:image` on the book page.

If you ship one thing from this section, ship this.

---

## 7. Data model

```
Theme
  id            string, stable, used in URLs
  name          string
  risk          "Speculative" | "Aggressive" | "Moderate" | "Conservative"
  horizon       string
  claim         string   ← must be matchable by its own keyword list
  forCase       string   ~2 sentences
  againstCase   string   ~2 sentences
  kw            string[] positive keywords
  neg           string[] negative keywords
  assets        Asset[]

Asset
  ticker        string
  name          string
  kind          "Equity" | "ETF" | "Crypto" | "Treasury" | "Commodity"
  conviction    0–100
  why           string, one sentence
```

**Regression test that must run in CI:** every theme's own `claim` must build a book that resolves to that same theme. Three themes failed this during development — Healthspan, Robotics and Cyber — because their claims used words (`medicine`, `machines`, `security`) that were not in their own keyword lists. Clicking "Build this book" on those cards produced a no-match screen.

### Conviction scores

Currently editorial judgement. They are the weakest link in the product's credibility and `/method` says so openly. Production should tie conviction to **disclosed segment revenue** so a reader can check a score against a filing. Until then, keep the methodology page honest about it.

---

## 8. API surface

```
POST /api/compose            { premise }              → book
GET  /api/book/:slug                                  → cached book
GET  /api/quotes?tickers=…                            → prices, moves, sparklines
GET  /api/track/:slug                                 → return series vs index
GET  /api/universe                                    → full universe + reviewed date
GET  /api/og?p=…                                      → PNG, 1200×630
```

Slug = URL-safe hash of the premise. Keep the raw premise in the query string too, so a book can be rebuilt with no database at all — that fallback is what makes sharing work on day one.

---

## 9. Wallet and token

`#/token` is live. Contract address field reads **Coming soon** and the copy button is disabled.

Wallet connect is **real EIP-1193**, not decorative:

```js
window.ethereum.request({ method: "eth_requestAccounts" })
```

Shows a truncated address, listens for `accountsChanged`, click again to disconnect, and reports honestly when no wallet is present.

**Security rules already written into `/legal` — keep them true:**

- The site never requests a signature, a transaction, a seed phrase or a private key. Connect reads the public address only.
- No presale, no whitelist, no team wallet accepting deposits.
- The CA appears on the site and on X at the same moment and nowhere else first.

The highest-risk window for this project is **right now, before the CA exists**, because that is when scammers publish fake addresses. The anti-scam language on `/token`, `/status` and `/legal` is there for that reason. Do not soften it.

---

## 10. Placeholders to replace before deploy

| Placeholder | Occurrences |
|---|---|
| `x.com/premisefi` | 6 |
| `t.me/premiseportal` | 7 |
| `PREM` (ticker) | 3 |
| `premise.app` (domain) | 7 |
| `Robinhood Chain` | 2 |
| Universe reviewed date `1 September 2026` | 3 |

---

## 11. Design system

Port the tokens as-is. The visual language was iterated on heavily and approved.

```css
--bg:#0A0A0B    --bg-2:#0D0D0F
--surf:rgba(255,255,255,.026)   --surf-2:.048   --surf-3:.075
--bd:rgba(255,255,255,.068)     --bd-2:.115
--fg:#FAFAFA  --fg-2:#9E9EA6  --fg-3:#6B6B74  --fg-4:#45454D
--ac:#7C8CFF  --ac-2:#AEB6FF  --ac-dim:rgba(124,140,255,.16)
--warn:#FF8A6B
--r:16px  --r-s:10px
```

Font: **Inter** only, weights 300–800, tight tracking (headings −0.04em).

Depth comes from three layers stacked in this order and nothing else:
1. Fixed radial gradient bloom (`.glow`)
2. SVG turbulence grain at 34% opacity, `mix-blend-mode: overlay` (`.grain`)
3. Panels: `inset 0 0 0 1px` hairline + a large soft drop shadow

**Signature components — reuse, do not redesign:**

- **`.window`** — the browser-chrome frame (dots + URL bar). It appears on the landing hero, the book page, trending and track. It is what makes each screen read as a product rather than a document.
- **`.bar`** — the allocation bar. White gradient = lead position, descending white opacity = conviction order, indigo = ballast. Colour carries information here; it is not decoration.

Motion budget is deliberately small: one hero typing sequence, one bar reveal, scroll fade-ins, hover lifts. `prefers-reduced-motion` is fully respected. Do not add more.

Accessibility already in place: visible focus rings, `aria-label` on every bar segment carrying its ticker, weight and reason, keyboard-reachable segments, `role="list"`.

---

## 12. Build order

1. **Server routes + per-page canonicals + dynamic OG image.** Cheapest work, largest payoff, and it is exactly where the competitor is broken.
2. **Real market data.** Removes every "prototype figures" warning currently on the site.
3. **LLM matcher** behind `/api/compose`, keyword matcher retained as fallback.
4. **Persistence** — books and history survive a refresh; a real `/history`.
5. **Conviction tied to segment revenue**, with sources cited on `/universe`.
6. Public books, follow and fork — needs auth, so last.

---

## 13. Do not break these

Every one of these was a bug that testing caught. They are all guarded by regression tests you should port.

- **Weights total exactly 100.0%** after rounding, every time.
- **The lead position always comes from the primary theme.** Never the secondary.
- **No duplicate tickers** in one book.
- **No risky holding below 5%.** Ballast may exceed it.
- **No holding above 27%.**
- **Every theme claim builds its own theme.**
- **Same premise → identical book**, always.
- **`matched: false` is a valid, shippable outcome.**
- **The benchmark is not rigged.** Roughly half of books should lose.

---

## 14. Known limitations, stated plainly

The site already publishes these on `/method` and `/status`. Keep them published.

- The matcher is string matching. It cannot understand a sentence.
- 164 names, heavily US-listed, almost no small caps outside the 26 themes.
- Conviction scores are one person's editorial judgement and are not audited.
- All market data is synthetic.
- Session history dies on refresh.
- No order routing. It needs a broker relationship and custody, not a front end.

A research product that hides its own weaknesses has the same credibility problem as one that hides its methodology. The transparency is a feature, not a placeholder.
