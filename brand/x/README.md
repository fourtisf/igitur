# X post banner

`x-post-banner.png` — 3200×1800 (16:9 at 2×), for attaching to a post.
`x-post-banner@1x.png` — the same at 1600×900, if 2.2 MB is inconvenient.

Not the profile header. That is `../x-header.png`, 1500×500.

## Regenerating

```bash
npx tsx -e 'import { buildBook } from "./lib/generator"; …'   # writes book.json
node brand/x/make-banner.mjs
```

The holdings come from `lib/generator` at build time and are written to
`book.json` first — a banner advertising a tool that shows real weights should
not carry invented ones. Regenerate `book.json` whenever the universe changes,
or the banner will quietly show weights the site no longer produces.

It is built from the site's own tokens, mark and allocation-bar CSS rather than
redrawn, so the image and the page a reader lands on are recognisably the same
object. Inter comes from the `.next` build output, so **run `npm run build`
first** or the fonts fall back to a system sans.
