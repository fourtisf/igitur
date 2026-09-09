# X images

## Launch thread — five cards, one per post

| File | Post | What it carries |
|---|---|---|
| `01-statement.png` | 1/5 | The proposition, with the allocation bar |
| `02-reasons.png` | 2/5 | The holdings and the reason under each weight |
| `03-refusal.png` | 3/5 | A premise the generator genuinely refuses |
| `04-benchmark.png` | 4/5 | Why half of all books lose to the index |
| `05-record.png` | 5/5 | A dated claim on the public record |

3200×1800 (16:9 at 2×). `x-post-banner.png` is the same as card 1, kept under
its old name for a standalone post.

Not the profile header — that is `../x-header.png`, 1500×500.

## Regenerating

```bash
npm run build                 # Inter is read out of .next; without it the
node brand/x/make-thread.mjs  # fonts fall back to a system sans
```

`book.json` holds the figures and is written by `lib/generator`, not by hand: a
banner selling a tool whose claim is that every weight carries a reason must not
carry weights somebody typed in. Regenerate it whenever the universe changes, or
the cards will quietly show weights the site no longer produces:

```bash
npx tsx -e 'import { buildBook } from "./lib/generator"; …'   # see git history
```

The refused premise on card 3 is asserted to still refuse when book.json is
built. If a future universe learns to match it, that assertion fails rather than
letting the card claim a refusal that no longer happens.

## What these cards deliberately do not show

Card 4 is typographic where a chart would be obvious. It makes a claim about how
the benchmark is constructed, not about performance, and the return series is
synthetic until a vendor key is configured — a marketing image is the one place
a caveat cannot travel with the number.
