# Brand marks

Logo directions for Igitur. Concepts, not a finished identity — nothing here is
wired into the app yet; `app/icon.svg` still carries the old allocation-bar
favicon.

## The idea

*Igitur* is Latin for "therefore", and the therefore sign is **∴** — three dots
in a triangle, from logic and proof notation. The name has a symbol already, and
the three-dot motif is native to the design system: the fake browser chrome
(`.wdots`) is three dots.

| File | Concept |
|---|---|
| `mark-therefore.svg` | ∴ in one colour, inherits `currentColor`. The primary mark. |
| `mark-therefore-conviction.svg` | ∴ coloured in conviction order — white lead, indigo ballast. A large-size treatment of the same mark, **not** a separate logo: below ~24px the mid-tone dot disappears against the dark ground. |
| `mark-therefore-bar.svg` | Two premise dots above, the conclusion as a bar segment. |
| `mark-inference.svg` | Premises above a rule, conclusion below — formal proof notation. Loses the rule below ~24px. |
| `mark-bar.svg` | The allocation bar, evolved from the old favicon. Honest, but a bar-chart mark is the most crowded space in fintech. |

## If one is adopted

- `app/icon.svg` — the favicon
- `.bmark` in `app/globals.css` — the nav and footer wordmark tile
- `Wordmark()` in `app/api/og/route.tsx` — the share cards
