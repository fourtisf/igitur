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

## The visuals, and why each is the one it is

Cards 3 and 5 show the interface inside the site's own window frame rather than
describing it. Both are true: the refusal page really does list every theme
underneath the refusal, and a committed claim really does look like that. The
theme names, counts and risk labels come from `lib/universe`.

Card 4 draws the correction instead of the returns. Two panels, four book paths
each against a dashed index: on the left every path sits above it, which is what
the earlier build did; on the right they scatter. There is no axis and no
figure anywhere on it, because the return series is synthetic until a vendor key
is configured and a marketing image is the one place a caveat cannot travel with
a number. What the picture asserts — where the benchmark sits — is true today.

The grid on card 3 shows 19 themes and counts the rest. Four rows of five fit
the frame; a fifth row is clipped by the canvas edge, and a frame cut off at the
bottom reads as a broken screenshot rather than a full one.
