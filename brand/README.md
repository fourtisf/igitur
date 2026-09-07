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

## Earlier directions

Kept for reference, not in use: `mark-therefore*.svg` (the therefore sign, ∴ —
the symbol for the word "igitur" itself), `mark-inference.svg`,
`mark-bar.svg`, and the intermediate `mark-a3-*.svg` studies.
