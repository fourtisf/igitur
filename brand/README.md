# Brand marks

## The mark

Two premises above, one position below.

The second premise is **0.70 the width** of the first — the same discount
`buildBook()` applies to a secondary theme, so the proportion comes from the
product's own rule rather than from taste. The conclusion is white and heavier
because in the allocation bar white is the lead position; an earlier draft made
it indigo, which is the ballast colour, and said the opposite of what was meant.

Everything sits on one 32-unit grid: a 20-unit span, premises and conclusion
sharing the same left and right edges. That alignment is what makes it read as
drawn rather than placed.

| File | Use |
|---|---|
| `igitur-mark.svg` | The mark. Mirrored in `BrandMark` in `components/icons.tsx`. |
| `igitur-mark-gradient.svg` | Conclusion carries a white-to-periwinkle gradient, continuing the old `.bmark` treatment. Swap in if the flat mark reads too plain at large sizes. |
| `igitur-mark-mono.svg` | One colour, inherits `currentColor`. For light grounds, print, stamping. |
| `igitur-icon.svg` | The mark inside a dark rounded tile. Shipped as `app/icon.svg`. |

Checked down to 12px. Below about 16px the indigo premise reads as a small
accent rather than a distinct shape, which is the intended behaviour.

## Where it is wired

- `app/icon.svg` — favicon and app icon
- `BrandMark` in `components/icons.tsx` — nav and footer
- `Wordmark()` in `app/api/og/route.tsx` — share cards, rebuilt from flex boxes
  because Satori renders only a subset of SVG

## Social assets

Built for X, and shaped by how X actually displays them: the profile picture is
cropped to a **circle** and shown as small as 24px on replies.

| File | Size | Use |
|---|---|---|
| `x-avatar.png` | 1000×1000 | Profile picture. Upload this one — X downscales, and starting from more pixels keeps the edges clean. |
| `x-avatar-400.png` | 400×400 | X's stated recommendation, if you would rather match it exactly. |
| `x-header.png` | 1500×500 | Header banner. |

Two decisions follow from the circular crop. The background bleeds to every edge,
so nothing is lost when the corners are cut — a rounded-tile icon would lose its
corners here. And the mark's ink spans 56% of the canvas rather than the ~49% it
occupies in `igitur-icon.svg`, because at 24px the smaller proportion stops
resolving.

The header keeps its content on the right. X overlays the profile picture across
the bottom-left of the banner, and anything placed there is covered.

## Earlier directions

Kept for reference, not in use: `mark-therefore*.svg` (the therefore sign, ∴ —
the symbol for the word "igitur" itself), `mark-inference.svg`,
`mark-bar.svg`, and the intermediate `mark-a3-*.svg` studies.
