# Premise

Write one sentence stating a belief about the next decade. Premise returns a
**book**: a weighted portfolio of 5–8 holdings where every weight carries a
written reason, plus the case for and against the underlying thesis.

Nothing places an order. It is research output only.

---

## What this repository is

`premise.html` is the original single-file prototype. It is kept in the repo on
purpose: `tests/fidelity.test.ts` loads the generator straight out of it and
diffs it against the ported one, so the two cannot silently drift.

Everything else is the production build — a Next.js app that ports the
prototype's logic without rebuilding it, and adds the things a single HTML file
could not do.

`HANDOFF.md` is the engineering handoff the port was built from. Section
numbers referenced in code comments point at it.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Regression tests (see below) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
app/                 routes — one real URL per page, each with its own canonical
  b/[slug]/          the book page, server-rendered from ?p=
  track/[slug]/      performance against the index
  api/og/            1200x630 share image, generated per book
  sitemap.ts         one entry per theme claim
components/          Bar, Holdings and the client islands
lib/
  universe.ts        26 themes, 170 assets, 354 keywords   ← the data
  generator.ts       scoreThemes + buildBook               ← the core IP
  market.ts          synthetic data behind a vendor seam   ← REPLACE
  site.ts            every pre-deploy placeholder, in one file
tests/               invariants, fidelity, benchmark fairness
premise.html         the original prototype, kept as the fidelity reference
```

## Two things that must not be "improved"

**It refuses.** A premise outside the universe returns no book at all. The app
does not assemble a plausible-looking portfolio out of adjacent vocabulary.
`ok: false` is a valid, shippable outcome.

**The benchmark is not rigged.** Book drift is centred on the index, so roughly
half of all books lose to it — 14 of the 26 theme claims beat it, 12 do not.
An earlier build gave the book a higher drift than the index, which meant every
book beat the market. That was a marketing claim baked into the code.

Both are covered by tests.

## The invariants

`npm test` enforces the list from `HANDOFF.md` §13:

- weights total exactly 100.0% after rounding, every time
- the lead position always comes from the primary theme, never the secondary
- no duplicate tickers in one book
- no risky holding below 5%, none above 27%
- every theme's own claim builds that same theme
- the same premise produces an identical book, always
- a book only ever holds names from the published universe
- `ok: false` is a valid outcome
- the benchmark is not rigged

`tests/fidelity.test.ts` additionally diffs the ported generator against the
prototype across ~3,300 book comparisons. If you deliberately change the
generator, that test is the one to update last and on purpose.

## Still to do

In build order (`HANDOFF.md` §12):

1. ~~Server routes, per-page canonicals, dynamic OG image~~ — **done**
2. **Real market data.** Everything in `lib/market.ts` is generated from the
   ticker string. Swap the function bodies for a vendor; `SYNTHETIC = false`
   then removes the "prototype figures" warnings the UI shows today.
3. **LLM matcher** behind `POST /api/compose`, with the keyword matcher kept as
   the fallback. The weighting formula stays in application code so weights stay
   auditable and reproducible. The model must be allowed to return
   `matched: false`, and must not invent tickers.
4. Persistence — books and history that survive a refresh.
5. Conviction tied to disclosed segment revenue, with sources on `/universe`.
6. Public books, follow and fork.

## Before deploy

Set `NEXT_PUBLIC_SITE_URL` to the real domain — it drives every canonical link,
the sitemap and the OG image URLs.

Everything else flagged in `HANDOFF.md` §10 lives in `lib/site.ts`: the X and
Telegram links, the token ticker, supply and chain, and the contract address
(which stays `null`, rendering as "Coming soon", until there is one).
