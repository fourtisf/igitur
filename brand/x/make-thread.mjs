/**
 * The five images for the launch thread.
 *
 * One shell, five bodies, so they read as a set rather than five designs that
 * happen to share a colour. Everything comes from the site's own tokens, mark
 * and allocation-bar CSS, and every figure is produced by lib/generator into
 * book.json first — including the premise on card 3, which is checked to still
 * be one the generator genuinely refuses.
 *
 * Card 4 is deliberately typographic. It makes a claim about how the benchmark
 * is built, not about performance, and drawing a chart there would put a
 * synthetic return series on a marketing image with no room for the warning
 * that follows it everywhere else on the site.
 *
 *   npm run build && node brand/x/make-thread.mjs
 */
import { chromium } from "playwright";
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const W = 1600;
const H = 900;

const MEDIA = join(ROOT, ".next", "static", "media");
const faces = readdirSync(MEDIA)
  .filter((f) => f.endsWith(".woff2"))
  .map((f) => `@font-face{font-family:Inter;src:url("file://${join(MEDIA, f)}") format("woff2");font-weight:100 900;font-display:block}`)
  .join("\n");

const book = JSON.parse(readFileSync(join(HERE, "book.json"), "utf8"));
const lead = book.holdings[0];

const CSS = `
${faces}
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0A0A0B;--fg:#FAFAFA;--fg-2:#9E9EA6;--fg-3:#8A8A92;--fg-4:#7A7A82;
  --ac:#7C8CFF;--ac-2:#AEB6FF;--bd:rgba(255,255,255,.068);--bd-2:rgba(255,255,255,.115)}
html,body{width:${W}px;height:${H}px}
body{background:var(--bg);font-family:Inter,system-ui,sans-serif;color:var(--fg);
  -webkit-font-smoothing:antialiased;position:relative;overflow:hidden}
.glow{position:absolute;inset:0;
  background:radial-gradient(900px 560px at 46% -10%,rgba(124,140,255,.17),transparent 64%),
             radial-gradient(640px 460px at 92% 8%,rgba(160,140,255,.08),transparent 62%)}
.grain{position:absolute;inset:0;opacity:.30;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{position:relative;z-index:2;height:100%;padding:74px 86px 66px;
  display:flex;flex-direction:column;justify-content:space-between}

.brand{display:flex;align-items:center;gap:18px}
.mark{display:flex;flex-direction:column;gap:6.5px;width:44px}
.mark .top{display:flex;gap:3.2px;height:9px}
.mark .p1{width:22.8px;background:rgba(255,255,255,.36);border-radius:4.5px}
.mark .p2{width:16px;background:var(--ac);border-radius:4.5px}
.mark .concl{width:44px;height:12.5px;background:var(--fg);border-radius:6.25px}
.name{font-size:34px;font-weight:600;letter-spacing:-.025em}
.dot{width:4px;height:4px;border-radius:50%;background:var(--fg-4);margin:0 4px}
.url{font-size:21px;color:var(--fg-4)}
.step{margin-left:auto;font-size:19px;color:var(--fg-4);letter-spacing:.06em}

h1{font-size:96px;line-height:1.02;letter-spacing:-.04em;font-weight:600;max-width:24ch}
h1 em{font-style:normal;color:var(--ac-2)}
h1.mid{font-size:78px;max-width:20ch}
/* The refusal runs two lines at this measure. Three, with "claim." alone on
   the last, made a confident sentence look like it had run out of room. */
h1.wide{max-width:27ch}
.sub{margin-top:26px;font-size:29px;line-height:1.4;color:var(--fg-2);width:1180px;font-weight:350}
.kick{font-size:15px;letter-spacing:.14em;color:var(--fg-4);text-transform:uppercase}

.bar{display:flex;gap:5px;height:168px}
.bar>div{position:relative;display:flex;flex-direction:column;justify-content:flex-end;
  padding:12px 13px 13px;min-width:0;overflow:hidden;border-radius:11px;
  background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.035));
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.075)}
.bar .lead{background:linear-gradient(180deg,#fff,#C9CEFF 55%,#8B95E8);color:#0A0A0B;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),0 0 46px -8px rgba(174,182,255,.6)}
.bar .bal{background:linear-gradient(180deg,rgba(124,140,255,.5),rgba(76,88,180,.28));
  box-shadow:inset 0 0 0 1px rgba(124,140,255,.35)}
.bar b{font-size:17px;font-weight:600;letter-spacing:-.01em;display:block;white-space:nowrap}
.bar i{font-style:normal;font-size:15px;opacity:.66;display:block;margin-top:3px}
.bar .lead i{opacity:.62}

.claim{font-size:25px;color:var(--fg);font-weight:350;display:flex;align-items:baseline;margin-bottom:2px}
.claim .kick{margin-right:18px}
.foot{display:flex;justify-content:space-between;align-items:baseline;gap:40px;
  border-top:1px solid var(--bd);padding-top:22px;font-size:20px}
.foot .why{color:var(--fg-2);font-weight:350}
.foot .why b{color:var(--fg);font-weight:600;margin-right:14px;letter-spacing:-.01em}
.foot .meta{color:var(--fg-4);white-space:nowrap;font-size:19px}

/* Card 1: the introduction. A name, what it is, and its size — the three
   things a stranger scrolling past has no way to know. */
.intro-mark{display:flex;flex-direction:column;gap:10px;width:70px}
.intro-mark .top{display:flex;gap:5px;height:14.5px}
.intro-mark .p1{width:36.3px;background:rgba(255,255,255,.36);border-radius:8.5px}
.intro-mark .p2{width:25.4px;background:var(--ac);border-radius:8.5px}
.intro-mark .concl{width:70px;height:19.9px;background:var(--fg);border-radius:11.65px}
.wordmark{font-size:88px;font-weight:600;letter-spacing:-.045em;line-height:1}
.tagline{font-size:31px;color:var(--fg-2);font-weight:350;max-width:52ch;line-height:1.38}
.stats{display:flex;gap:64px}
.stat b{display:block;font-size:52px;font-weight:600;letter-spacing:-.035em;line-height:1}
.stat span{display:block;font-size:18px;color:var(--fg-4);margin-top:9px;letter-spacing:.05em;
  text-transform:uppercase}
.stat.accent b{color:var(--ac-2)}

/* Card 2: the reasons, which are the product. */
.rows{display:flex;flex-direction:column;gap:2px}
.row{display:grid;grid-template-columns:118px 1fr 96px;gap:26px;align-items:baseline;
  padding:17px 20px;border-radius:10px;background:rgba(255,255,255,.026);
  box-shadow:inset 0 0 0 1px var(--bd)}
.row.is-lead{background:rgba(124,140,255,.10);box-shadow:inset 0 0 0 1px rgba(124,140,255,.28)}
.row .t{font-size:23px;font-weight:600;letter-spacing:-.02em}
.row .w{font-size:22px;color:var(--fg-2);font-weight:350}
.row .pct{font-size:23px;font-weight:600;text-align:right;letter-spacing:-.02em}
.row.is-bal .t,.row.is-bal .pct{color:var(--ac-2)}

/* Card 3: the refusal. Mostly empty on purpose. */
.badge{display:inline-flex;align-items:center;gap:12px;padding:9px 18px;border-radius:99px;
  font-size:17px;color:var(--fg-2);background:rgba(255,255,255,.04);
  box-shadow:inset 0 0 0 1px var(--bd-2)}
.badge b{color:var(--fg);font-weight:600}
.typed{font-size:30px;color:var(--fg-3);font-weight:350}
.typed span{color:var(--fg)}

/* The site's own product frame. Cards 3 and 5 show the interface rather than
   describing it — the refusal page really does list every theme underneath, and
   a committed claim really does look like this. */
.window{border-radius:16px;overflow:hidden;text-align:left;
  background:linear-gradient(180deg,#141417,#0C0C0E);
  box-shadow:inset 0 0 0 1px var(--bd-2),0 60px 120px -50px rgba(0,0,0,1),
             0 0 90px -40px rgba(124,140,255,.35)}
.wbar{display:flex;align-items:center;gap:14px;padding:14px 18px;
  border-bottom:1px solid var(--bd);background:rgba(255,255,255,.02)}
.wdots{display:flex;gap:7px}
.wdots i{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.075);display:block}
.wurl{flex:1;font-size:15px;color:var(--fg-4);background:rgba(255,255,255,.026);border-radius:7px;
  padding:7px 13px;box-shadow:inset 0 0 0 1px var(--bd);white-space:nowrap}
.wbody{padding:22px 24px}

/* Card 3: the 26 themes the universe does hold, none of which matched. */
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.gcell{padding:11px 13px;border-radius:10px;background:rgba(255,255,255,.026);
  box-shadow:inset 0 0 0 1px var(--bd);min-width:0}
.gcell h4{font-size:15px;font-weight:600;letter-spacing:-.012em;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.gcell p{font-size:12.5px;color:var(--fg-4);margin-top:4px;font-weight:350}
.gmore{display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--fg-3)}

/* Card 4: the correction, drawn. No axis and no figures — this is a diagram of
   how the benchmark is positioned, not a claim about what anything returned. */
.panels{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.panel{padding:24px 26px 20px;border-radius:14px;background:rgba(255,255,255,.022);
  box-shadow:inset 0 0 0 1px var(--bd)}
.panel.now{background:rgba(124,140,255,.07);box-shadow:inset 0 0 0 1px rgba(124,140,255,.26)}
.plabel{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-4)}
.panel.now .plabel{color:var(--ac-2)}
.pnote{font-size:19px;color:var(--fg-2);margin-top:16px;font-weight:350}
.panel svg{display:block;width:100%;height:150px;margin-top:16px}

/* Card 5: one committed claim, inside the frame. */
.rec-date{display:block;font-size:17px;color:var(--ac-2);letter-spacing:.06em;text-transform:uppercase}
.rec-said{font-size:34px;line-height:1.25;letter-spacing:-.025em;font-weight:500;margin-top:12px}
`;

function shell(step, body) {
  return `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
<div class="glow"></div><div class="grain"></div>
<div class="wrap">
  <div class="brand">
    <div class="mark"><div class="top"><div class="p1"></div><div class="p2"></div></div><div class="concl"></div></div>
    <div class="name">Igitur</div><div class="dot"></div><div class="url">igitur.xyz</div>
    <div class="step">${step}</div>
  </div>
  ${body}
</div>`;
}

/** The intro card carries the wordmark itself, so it drops the brand row. */
function shellBare(step, body) {
  return `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
<div class="glow"></div><div class="grain"></div>
<div class="wrap">
  <div class="brand"><div class="url">igitur.xyz</div><div class="step">${step}</div></div>
  ${body}
</div>`;
}

const bar = book.holdings
  .map((h) => `<div class="${h.lead ? "lead" : h.ballast ? "bal" : ""}" style="flex:${h.pct}">
      <b>${h.t}</b><i>${h.pct}%</i></div>`)
  .join("");

/** Four rows of five. The remainder is counted rather than clipped — a frame
 *  cut off by the canvas edge reads as a broken screenshot, not a full one. */
const SHOWN = 19;
const grid = book.themes.slice(0, SHOWN)
  .map((t) => `<div class="gcell"><h4>${t.name}</h4><p>${t.n} names · ${t.risk}</p></div>`)
  .join("") +
  `<div class="gcell gmore">+${book.themes.length - SHOWN} more</div>`;

/**
 * Four book paths against a flat index, as a diagram.
 *
 * `bias` lifts every path, which is what the earlier build did. At 0 they
 * scatter around the line. Deterministic, so the picture is the same each run.
 */
function paths(bias) {
  const w = 460, h = 150, mid = h / 2;
  let out = `<line x1="0" y1="${mid}" x2="${w}" y2="${mid}" stroke="rgba(255,255,255,.30)" stroke-width="2" stroke-dasharray="4 6"/>`;
  const seeds = [0.9, -0.55, 0.35, -0.8];
  for (const seed of seeds) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const wobble = Math.sin(t * 6.2 + seed * 4) * 7;
      const end = (bias ? 0.55 + Math.abs(seed) * 0.45 : seed) * 62;
      pts.push(`${(t * w).toFixed(1)},${(mid - t * end + wobble).toFixed(1)}`);
    }
    const up = (bias ? 1 : seed) > 0;
    out += `<polyline points="${pts.join(" ")}" fill="none" stroke="${up ? "#AEB6FF" : "#7A7A82"}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${out}</svg>`;
}

const rows = book.holdings
  .map((h) => `<div class="row${h.lead ? " is-lead" : ""}${h.ballast ? " is-bal" : ""}">
      <span class="t">${h.t}</span><span class="w">${h.why}</span><span class="pct">${h.pct}%</span>
    </div>`)
  .join("");

const CARDS = {
  "01-intro": shellBare("1 / 5", `
  <div style="display:flex;align-items:flex-start;gap:36px">
    <div class="intro-mark" style="margin-top:20px">
      <div class="top"><div class="p1"></div><div class="p2"></div></div>
      <div class="concl"></div>
    </div>
    <div>
      <p class="kick" style="margin-bottom:12px">Introducing</p>
      <h1 class="wordmark">Igitur</h1>
    </div>
  </div>

  <p class="tagline">One stated belief about the next decade, turned into a weighted portfolio —
    where every weight carries the reason it earned its size.</p>

  <div class="stats">
    <div class="stat"><b>${book.themeCount}</b><span>Written theses</span></div>
    <div class="stat"><b>${book.nameCount}</b><span>Names, each with a reason</span></div>
    <div class="stat accent"><b>0</b><span>Guesses</span></div>
  </div>

  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="bar" style="height:104px">${bar}</div>
    <div class="foot">
      <span class="why"><b>${lead.t} ${lead.pct}%</b>${lead.why}</span>
      <span class="meta">From “${book.premise.slice(0, 46)}…”</span>
    </div>
  </div>
`),

  "02-reasons": shell("2 / 5", `
  <div>
    <p class="kick" style="margin-bottom:16px">The premise</p>
    <h1 class="mid" style="font-size:44px;max-width:44ch;line-height:1.2">“${book.premise}”</h1>
  </div>
  <div class="rows">${rows}</div>
  <div class="foot">
    <span class="why">Every weight carries the reason it earned its size.</span>
    <span class="meta">${book.theme} · ${book.holdings.length} holdings · total 100%</span>
  </div>`),

  "03-refusal": shell("3 / 5", `
  <div>
    <div class="badge"><b>No match</b> Nothing was generated</div>
    <h1 class="mid wide" style="margin-top:20px;font-size:56px">No theme in this universe carries that claim.</h1>
    <p class="typed" style="margin-top:14px;font-size:26px">You wrote “<span>${book.refused}</span>”</p>
  </div>
  <div class="window">
    <div class="wbar"><div class="wdots"><i></i><i></i><i></i></div>
      <div class="wurl">igitur.xyz/compose</div></div>
    <div class="wbody">
      <p class="kick" style="margin-bottom:14px">What it does hold — ${book.themeCount} written theses</p>
      <div class="grid">${grid}</div>
    </div>
  </div>
`),

  "04-benchmark": shell("4 / 5", `
  <div>
    <h1 class="mid" style="max-width:26ch">Roughly half of all books <em>lose</em> to the index.</h1>
  </div>
  <div class="panels">
    <div class="panel">
      <span class="plabel">An earlier build</span>
      ${paths(true)}
      <p class="pnote">Every book drifted above the benchmark. Everything beat the market — a
        claim the interface was making on its own.</p>
    </div>
    <div class="panel now">
      <span class="plabel">Now</span>
      ${paths(false)}
      <p class="pnote">Centred on the index. Some books win, some lose, and the benchmark is drawn
        either way.</p>
    </div>
  </div>
  <div class="foot">
    <span class="why">Nothing here should be able to flatter itself.</span>
    <span class="meta">Dashed line: the index</span>
  </div>
`),

  "05-record": shell("5 / 5", `
  <div>
    <h1 class="mid" style="font-size:66px">Put a claim on the record.</h1>
    <p class="sub" style="margin-top:20px;font-size:26px">The date is written by the server the day
      you commit it. Not in the link, not editable afterwards.</p>
  </div>
  <div class="window">
    <div class="wbar"><div class="wdots"><i></i><i></i><i></i></div>
      <div class="wurl">igitur.xyz/p/JijInjp7L4E</div></div>
    <div class="wbody">
      <span class="rec-date">On the record · stated 9 September 2026</span>
      <p class="rec-said">“${book.premise}”</p>
      <div class="bar" style="height:104px;margin-top:22px">${bar}</div>
    </div>
  </div>
  <div class="foot">
    <span class="why">Measured against the index from that date. Win or lose, it stays up.</span>
    <span class="meta">igitur.xyz/ledger</span>
  </div>
`),
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
for (const [name, html] of Object.entries(CARDS)) {
  const file = join(HERE, `${name}.html`);
  writeFileSync(file, html);
  await page.goto("file://" + file);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(320);
  await page.screenshot({ path: join(HERE, `${name}.png`) });
  console.log(`  ${name}.png`);
}
await browser.close();
console.log(`${Object.keys(CARDS).length} kartu · ${W * 2}×${H * 2}`);
