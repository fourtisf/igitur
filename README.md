# Igitur

Write one sentence stating a belief about the next decade. Igitur returns a
**book**: a weighted portfolio of 5–8 holdings where every weight carries a
written reason, plus the case for and against the underlying thesis.

Nothing places an order. It is research output only.

---

## What this repository is

`premise.html` is the original single-file prototype, from back when the
product was called Premise. It keeps that filename on purpose: `tests/fidelity.test.ts`
loads the generator straight out of it and diffs it against the ported one, so
the two cannot silently drift. Renaming it would only break that link — it is a
historical artifact, not source.

`premise` also stays as the domain word throughout the code (`?p=`,
`normalizePremise`, `buildBook(premise)`). The brand changed; the mechanism did
not. You still state a premise.

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
components/          Bar, Holdings, Composer and the client islands
lib/
  universe.ts        26 themes, 170 assets, 354 keywords   ← the data
  generator.ts       scoreThemes + buildBook + assemble    ← the core IP
  matcher/           the model that reads a refused premise
  nearmiss.ts        how a refusal is ranked and explained
  ledger.ts          the append-only public record
  market.ts          synthetic data behind a vendor seam   ← REPLACE
  site.ts            every pre-deploy placeholder, in one file
scripts/
  seed-ledger.ts     puts the 26 house theses on the record, once
tests/               invariants, fidelity, benchmark fairness
premise.html         the original prototype, kept as the fidelity reference
```

## Two things that must not be "improved"

**It refuses.** A premise outside the universe returns no book at all. The app
does not assemble a plausible-looking portfolio out of adjacent vocabulary.
`ok: false` is a valid, shippable outcome. `lib/nearmiss.ts` ranks and explains
the way out of a refusal — including the negative keyword that vetoed a theme —
but every route it offers builds a *theme's own written claim*, never the
refused premise. `tests/nearmiss.test.ts` is what stops it becoming a second,
looser matcher.

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

`tests/universe.test.ts` guards the data itself, so it cannot rot quietly: no
uppercase keyword (which could never match, because the matcher lowercases its
input), no keyword that is both positive and negative for the same theme, no
ticker meaning two different companies in two themes, no conviction out of
range, no holding without a written reason, and no theme shadowed by another
such that its own claim never reaches it.

`tests/premise.test.ts` pins the only untrusted input: the premise is bounded,
truncation stays deterministic, whitespace variants collapse to one book, and
the share-card allowlist rejects anything not in it.

## Still to do

In build order (`HANDOFF.md` §12):

1. ~~Server routes, per-page canonicals, dynamic OG image~~ — **done**
2. ~~Real market data~~ — **the layer is built**; it needs a key.
   `lib/market/` holds a provider interface, a Financial Modeling Prep
   implementation and the synthetic fallback. Set `MARKET_API_KEY` and the site
   switches: prices, market caps and session moves come from the vendor, and
   `/track` computes returns from real closes instead of a generated series.
   Every "prototype figures" warning is derived from the data rather than
   hard-coded, so they disappear on their own — including the line on `/status`.
   Anything the vendor cannot cover falls back per ticker and is still flagged.
   When it lands, take the `noindex` off `/track` and put its URLs back in the
   sitemap; they are held out today because publishing fabricated performance
   into a search index is the one thing that would make this site dishonest.
3. ~~**LLM matcher** behind `POST /api/compose`~~ — **the layer is built**; it
   needs a key. Set `ANTHROPIC_API_KEY` and a premise the keyword index refuses
   gets a second reading, which is the only thing that changes: the model is
   never asked about a premise the index already matched, so a shared link
   cannot start meaning something else.

   All three constraints are structural rather than asked for nicely. It picks
   an id from the 26 published themes through a schema enum, so an id outside
   them is not expressible; it never reaches the asset lists, so it has no
   ticker to invent; and it never sizes anything — `assemble()` in
   `lib/generator.ts` does the weighting for both matchers, which is what keeps
   the weights auditable. `matched: false` is a 200, because refusing is an
   answer. `tests/matcher.test.ts` holds all of it.
4. Persistence — books and history that survive a refresh.
5. Conviction tied to disclosed segment revenue, with sources on `/universe`.
6. Public books, follow and fork.

## Share images

Every route has one. `/api/og?p=<premise>` renders the book card — the
allocation bar, the theme, and why the lead position leads. `/api/og?page=<id>`
renders a card for a non-book page, from the fixed allowlist in
`lib/og-pages.ts`.

That allowlist is the point: there is deliberately no free-text mode. Letting
the route take a title and body off the query string would let anyone mint a
Igitur-branded image saying anything at all. A book card renders the reader's
own premise because the premise *is* the content; a page card renders only text
that ships in this repo.

Rendered PNGs are cached in process (bounded, oldest-evicted) and served
immutable, so a book being shared is rendered once rather than once per reader.

## Before deploy

Set `NEXT_PUBLIC_SITE_URL` to the real domain — it drives every canonical link,
the sitemap and the OG image URLs.

Everything else flagged in `HANDOFF.md` §10 lives in `lib/site.ts`: the X and
Telegram links, the token ticker, supply and chain, and the contract address
(which stays `null`, rendering as "Coming soon", until there is one).
