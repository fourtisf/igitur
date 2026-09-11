# X images

## Launch thread — five cards, one per post

| File | Post | What it carries |
|---|---|---|
|  `01-intro.png` | 1/5 | The name, what it is, its size, and the bar |
| `02-reasons.png` | 2/5 | The holdings and the reason under each weight |
| `03-refusal.png` | 3/5 | A premise the generator genuinely refuses |
| `04-benchmark.png` | 4/5 | Why half of all books lose to the index |
| `05-record.png` | 5/5 | A dated claim on the public record |

`06-token.png` is not part of the five — it is a standalone card for the
contract address, which does not exist yet. Post it on its own, never inside the
product thread.

3200×1800 (16:9 at 2×). `x-post-banner.png` is a copy of card 1, kept under
its old name for a standalone post.

## The assistant banner — `08-ask.png`

`node brand/x/make-ask.mjs`. Standalone, 3200×1800, for the /ask launch.

The workspace banner answers "is this a real tool?" by showing it running in a
room. This one answers the only question worth asking about an assistant bolted
to a site about portfolios: what will it refuse to do?

So the image is one exchange, and the exchange is the refusal. "Should I buy
NVDA?" is the first thing anybody types into it, and the answer on screen is the
product's whole position — it declines, says why it declines, and then hands
over the number it *can* stand behind, with the reason and the named judgement
that produced it. An image of the assistant being helpful about a ticker would
sell the opposite product.

Nothing on the screen is typed into the design. The weight and its reason come
from `book.json`; the conviction score is read out of `lib/universe.ts` and the
floor and cap out of `lib/reweight.ts` at render time. `tests/brand.test.ts`
fails if the universe moves past the snapshot — when it does, rebuild the images
rather than edit the numbers.

## The launch card — `09-token.png`

`node brand/x/make-token.mjs`. Standalone, 3200×1800.

Its job is unlike the others: this is the image somebody screenshots and holds
against the address in front of them before they trade. So the address is the
subject rather than a footnote — large, monospace, unbroken, with the last four
characters in white because that is the half a lookalike address cannot copy.

An earlier draft grouped it into sixes. It read beautifully and was wrong: a
reader comparing a spaced address here against an unspaced one in their wallet
is more likely to miss a mismatch, not less.

Deliberately quieter than the workspace and assistant banners. A launch card
that looks like an advertisement is the house style of every token that turned
out to be nothing; this one should read like a notice board.

The address is read from `lib/site.ts` at render time, never from `book.json` —
a snapshot of an address is a second copy of the one string on this project that
must not drift, and `tests/honesty.test.ts` fails the build if a literal appears
anywhere else. `06-token.png` in the thread reads it the same way.

## The workspace banner — `07-workspace.png`

`node brand/x/make-workspace.mjs`. One standalone image, same 3200×1800.

The five cards above are typographic: a claim, a figure, the bar. This one is a
scene, because it answers a different question. A stranger scrolling past has no
way to know this is a working tool rather than a landing page, and the quickest
way to say so is to show it running on a screen, in a room.

Two things it deliberately does not have:

**A person.** The developer-tool banners this borrows its composition from are
AI-generated photographs of somebody at a desk. A human rendered in CSS lands
between uncanny and cheap, and the room carries the message without one.

**Anything on screen that is not the product.** Both monitors are built from
`book.json`, like every other card here. A banner selling a tool whose whole
claim is that every weight carries a reason must not carry weights somebody
typed in.

The room is lit three ways — daylight from the window on the left, the sign's
own glow, and the pools the two screens throw down onto the desk. Take any one
away and it flattens into a gradient.

The token card carries the anti-scam warning verbatim from /token. A launch
image that shows a ticker and "coming soon" without it is the exact shape a
scammer copies, and the site's own promise — that the address appears here and
on X at the same moment and nowhere else first — is only enforceable if it
travels with the announcement.

Not the profile header — that is `../x-header.png`, 1500×500.

## The words

`copy.md` holds the post text for all of it — the standalone banner post,
the five-post thread, the token post, the bio and the standing replies. It opens
with the six claims this account may never make about itself, because copy is
where that discipline gets lost first.

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
