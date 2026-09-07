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
| `x-avatar.png` | 1000×1000 | Profile picture. Upload this one. |
| `x-avatar-400.png` | 400×400 | X's stated recommendation, if you prefer to match it exactly. |
| `x-avatar-flat.png` | 1000×1000 | Same, without the bloom. The restrained alternative. |
| `x-header.png` | 3000×1000 | Header banner. Shows the product working. |
| `x-header-statement.png` | 3000×1000 | Header alternative: the tagline, typographically. |

### How they are built

Depth follows the site's own three-layer recipe rather than being invented for
these files: a radial glow, then SVG turbulence grain at 34% `overlay`, then a
hairline inset rim. The first version used only the glow, which is why it read
as a wireframe on a flat field.

The conclusion pill carries a white-to-periwinkle gradient with a one-unit
specular along its top edge, so light falls from above — the same direction as
the panel shadows on the site. Beneath it sits a soft indigo bloom at 38%
opacity. That number was tuned against the alternatives: at 55% the halo starts
reading as a filter effect rather than as material.

Two things follow from the circular crop. The background bleeds to every edge,
so nothing is lost when the corners are cut, and the file is a full opaque
square — X does the cropping, and transparent corners would show as a box
anywhere the image is displayed uncropped. The mark's ink spans 56% of the
canvas rather than the ~49% it occupies in `igitur-icon.svg`, because below that
it stops resolving at reply size.

The header keeps its content clear of the bottom-left, where X overlays the
profile picture. `x-header.png` puts the real `.window` frame there — the site's
signature component — showing a premise and the book it produces, so the banner
demonstrates the product instead of describing it.

Headers export at 3000×1000 rather than X's stated 1500×500: the ratio is the
same, and the extra pixels survive downscaling on high-density screens.

## Earlier directions

Kept for reference, not in use: `mark-therefore*.svg` (the therefore sign, ∴ —
the symbol for the word "igitur" itself), `mark-inference.svg`,
`mark-bar.svg`, and the intermediate `mark-a3-*.svg` studies.
