/**
 * The workspace banner — one standalone image for a post or a pinned tweet.
 *
 * The five thread cards (make-thread.mjs) are typographic: a claim, a figure,
 * the bar. This one is a scene, because a scene answers a different question.
 * A stranger scrolling past has no idea this is a working tool rather than a
 * landing page, and the fastest way to say so is to show it running on a screen
 * in a room, the way every developer-tool banner does.
 *
 * ── What it deliberately does not have ───────────────────────────────────────
 *
 * A person. The banners this imitates are AI-generated photographs of someone
 * at a desk, and a fake human rendered in CSS lands somewhere between uncanny
 * and cheap. The room carries the same message without one.
 *
 * A screenshot that is not the product. Everything on both monitors is built
 * from book.json, which lib/generator writes — the same rule the rest of
 * brand/x follows. A banner selling a tool whose whole claim is that every
 * weight carries a reason must not carry weights somebody typed in.
 *
 *   npm run build && node brand/x/make-workspace.mjs
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

const bar = book.holdings
  .map((h) => `<div class="${h.lead ? "lead" : h.ballast ? "bal" : ""}" style="flex:${h.pct}">
       <b>${h.t}</b><i>${h.pct}%</i></div>`)
  .join("");

/** Four rows fit the right-hand screen without the last one being clipped. */
const rows = book.holdings
  .slice(0, 4)
  .map((h) => `<div class="row${h.lead ? " is-lead" : ""}">
       <span class="t">${h.t}</span><span class="w">${h.why}</span><span class="pct">${h.pct}%</span>
     </div>`)
  .join("");

const CSS = `
${faces}
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0A0A0B;--fg:#FAFAFA;--fg-2:#9E9EA6;--fg-3:#8A8A92;--fg-4:#7A7A82;
  --ac:#7C8CFF;--ac-2:#AEB6FF;--bd:rgba(255,255,255,.068);--bd-2:rgba(255,255,255,.115)}
html,body{width:${W}px;height:${H}px}
body{background:#08080A;font-family:Inter,system-ui,sans-serif;color:var(--fg);
  -webkit-font-smoothing:antialiased;position:relative;overflow:hidden}

/* ── The room ──────────────────────────────────────────────────────────────
   Three lights, in the order a room actually has them: daylight from a window
   off to the left, the wall sign's own glow, and the spill the monitors throw
   back onto the desk. Nothing here is decoration — take any one away and the
   scene flattens into a gradient. */
.wall{position:absolute;inset:0;
  background:
    radial-gradient(1200px 700px at 12% -12%,rgba(150,170,255,.10),transparent 62%),
    radial-gradient(900px 620px at 50% 26%,rgba(124,140,255,.13),transparent 66%),
    linear-gradient(180deg,#0C0C10 0%,#0A0A0C 52%,#070709 100%)}
/* Daylight from an off-frame window, raked across the wall. */
.daylight{position:absolute;top:-140px;left:-180px;width:760px;height:900px;
  transform:rotate(18deg);opacity:.5;
  background:linear-gradient(105deg,rgba(190,205,255,.10),rgba(190,205,255,.02) 46%,transparent 70%);
  filter:blur(26px)}
/* Off-frame left, deliberately low-contrast: it explains .daylight and gives
   the upper wall structure, and it must never compete with the interface. */
.win{position:absolute;left:-70px;top:60px;width:380px;height:700px;border-radius:4px;
  background:linear-gradient(160deg,rgba(150,170,255,.085),rgba(120,140,220,.025) 58%,transparent);
  box-shadow:inset 0 0 0 2px rgba(190,205,255,.09);
  /* Faded out at the bottom rather than stopped: a hard edge halfway down the
     wall reads as a stray rectangle, not as a window running past the desk. */
  -webkit-mask-image:linear-gradient(180deg,#000 48%,transparent 88%)}
.win i{position:absolute;background:rgba(190,205,255,.085);display:block}
.win i.v{top:0;bottom:0;width:2px;left:50%}
.win i.h{left:0;right:0;height:2px;top:34%}
/* City lights beyond it, at the threshold of visible. */
.win u{position:absolute;left:0;right:0;bottom:230px;height:200px;display:block;
  background:
    radial-gradient(2px 2px at 22% 74%,rgba(200,215,255,.5),transparent),
    radial-gradient(2px 2px at 58% 52%,rgba(200,215,255,.4),transparent),
    radial-gradient(2px 2px at 78% 82%,rgba(200,215,255,.45),transparent),
    radial-gradient(2px 2px at 38% 90%,rgba(200,215,255,.35),transparent),
    radial-gradient(2px 2px at 88% 62%,rgba(200,215,255,.3),transparent)}
.grain{position:absolute;inset:0;opacity:.32;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
.vignette{position:absolute;inset:0;
  background:radial-gradient(120% 90% at 50% 46%,transparent 52%,rgba(0,0,0,.62) 100%)}

/* ── The sign on the wall ──────────────────────────────────────────────────
   The mark's proportions are the product's own rule, not a visual preference:
   the second premise is 0.70 the width of the first, which is the discount
   buildBook() applies to a secondary theme. */
.sign{position:absolute;top:158px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:26px;
  filter:drop-shadow(0 0 60px rgba(174,182,255,.34))}
.mark{display:flex;flex-direction:column;gap:7px;width:48px}
.mark .top{display:flex;gap:3.5px;height:10px}
.mark .p1{width:24.9px;background:rgba(255,255,255,.42);border-radius:5px}
.mark .p2{width:17.4px;background:var(--ac);border-radius:5px}
.mark .concl{width:48px;height:13.7px;background:var(--fg);border-radius:6.85px}
.sign .word{font-size:46px;font-weight:600;letter-spacing:.07em}
/* The light the sign throws back onto the wall behind it. */
.sign-glow{position:absolute;top:118px;left:50%;transform:translateX(-50%);
  width:600px;height:200px;border-radius:50%;filter:blur(70px);
  background:radial-gradient(closest-side,rgba(124,140,255,.30),transparent)}

/* ── The desk ──────────────────────────────────────────────────────────────
   A plane in perspective, not a rectangle. The bright top edge is where the
   monitors' light lands, which is what makes it read as a surface. */
.desk{position:absolute;left:-10%;right:-10%;bottom:0;height:330px;
  background:linear-gradient(180deg,#24242C 0%,#17171D 30%,#0E0E12 68%,#09090B 100%);
  transform:perspective(1000px) rotateX(56deg);transform-origin:top center;
  box-shadow:0 -1px 0 rgba(255,255,255,.16),0 -40px 110px -30px rgba(124,140,255,.30)}
.deskline{position:absolute;left:0;right:0;bottom:284px;height:1.5px;z-index:3;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.26) 20%,rgba(255,255,255,.26) 80%,transparent)}
/* What the screens throw down. Without these the desk is a dark shape behind
   the monitors rather than the surface they are standing on. */
.pool{position:absolute;bottom:96px;height:210px;z-index:2;filter:blur(46px);pointer-events:none}
.pool.a{left:12%;width:44%;background:radial-gradient(closest-side,rgba(174,182,255,.30),transparent)}
.pool.b{right:10%;width:36%;background:radial-gradient(closest-side,rgba(174,182,255,.22),transparent)}

/* ── The monitors ─────────────────────────────────────────────────────────
   The site's own window frame, turned very slightly toward the centre. Enough
   to sit in the room; not enough to make the interface hard to read, which is
   the whole reason it is on the banner. */
.screens{position:absolute;left:0;right:0;bottom:258px;height:470px;z-index:3;
  display:flex;justify-content:center;align-items:flex-end;gap:30px;
  perspective:1800px}
.mon{position:relative;border-radius:14px;overflow:hidden;
  background:linear-gradient(180deg,#141417,#0B0B0D);
  box-shadow:inset 0 0 0 1px var(--bd-2),0 60px 120px -46px rgba(0,0,0,1),
             0 0 120px -34px rgba(124,140,255,.45)}
.mon.l{width:790px;transform:rotateY(8deg) rotateX(1.5deg)}
.mon.r{width:616px;transform:rotateY(-8deg) rotateX(1.5deg)}
.wbar{display:flex;align-items:center;gap:12px;padding:12px 15px;
  border-bottom:1px solid var(--bd);background:rgba(255,255,255,.02)}
.wdots{display:flex;gap:6px}
.wdots i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.075);display:block}
.wurl{flex:1;font-size:13px;color:var(--fg-4);background:rgba(255,255,255,.026);border-radius:6px;
  padding:6px 11px;box-shadow:inset 0 0 0 1px var(--bd);white-space:nowrap}
.wbody{padding:20px 22px 22px}
/* The screen's own light, laid over the glass. */
.mon::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(168deg,rgba(255,255,255,.055),transparent 42%)}

.kick{font-size:11.5px;letter-spacing:.14em;color:var(--fg-4);text-transform:uppercase}
.premise{font-size:19px;line-height:1.34;letter-spacing:-.02em;font-weight:450;margin-top:9px}
.tags{display:flex;gap:6px;margin-top:14px;flex-wrap:wrap}
.tag{font-size:11.5px;padding:5px 10px;border-radius:99px;color:var(--fg-3);
  background:rgba(255,255,255,.026);box-shadow:inset 0 0 0 1px var(--bd)}
.tag.on{color:var(--ac-2);background:rgba(124,140,255,.14);
  box-shadow:inset 0 0 0 1px rgba(124,140,255,.32)}

.bar{display:flex;gap:4px;height:78px;margin-top:16px}
.bar>div{position:relative;display:flex;flex-direction:column;justify-content:flex-end;
  padding:8px 9px 9px;min-width:0;overflow:hidden;border-radius:8px;
  background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.035));
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.075)}
.bar .lead{background:linear-gradient(180deg,#fff,#C9CEFF 55%,#8B95E8);color:#0A0A0B;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),0 0 34px -8px rgba(174,182,255,.6)}
.bar .bal{background:linear-gradient(180deg,rgba(124,140,255,.5),rgba(76,88,180,.28));
  box-shadow:inset 0 0 0 1px rgba(124,140,255,.35)}
.bar b{font-size:12px;font-weight:600;display:block;white-space:nowrap}
.bar i{font-style:normal;font-size:10.5px;opacity:.66;display:block;margin-top:2px}

.rows{display:flex;flex-direction:column;gap:2px;margin-top:12px}
.row{display:grid;grid-template-columns:58px 1fr 46px;gap:12px;align-items:baseline;
  padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.026);
  box-shadow:inset 0 0 0 1px var(--bd)}
.row.is-lead{background:rgba(124,140,255,.10);box-shadow:inset 0 0 0 1px rgba(124,140,255,.28)}
.row .t{font-size:13px;font-weight:600;letter-spacing:-.015em}
.row .w{font-size:12px;color:var(--fg-2);font-weight:350;line-height:1.35;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.row .pct{font-size:13px;font-weight:600;text-align:right}

/* ── Props ────────────────────────────────────────────────────────────────
   Three, in silhouette, sitting on the desk plane. Their only job is to give
   the monitors something to be in front of; anything more detailed starts
   competing with the interface, which is the thing worth looking at. */
.prop{position:absolute;bottom:186px;z-index:4;
  background:linear-gradient(180deg,#2E2E38,#15151A);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.20),inset 0 0 0 1px rgba(255,255,255,.08),
             0 20px 34px -16px rgba(0,0,0,.95)}
.mug{left:184px;width:50px;height:58px;border-radius:5px 5px 10px 10px}
.mug::after{content:"";position:absolute;right:-15px;top:14px;width:17px;height:25px;
  border:4px solid #2A2A33;border-left:none;border-radius:0 13px 13px 0}
.book{right:174px;width:150px;height:17px;border-radius:3px}
.book2{right:160px;bottom:203px;width:132px;height:13px;border-radius:3px;opacity:.8}
/* Keys, not a slab: at this size a plain rectangle reads as a shadow. */
.kbd{left:50%;bottom:126px;transform:translateX(-50%) perspective(560px) rotateX(58deg);
  width:470px;height:112px;border-radius:10px;
  background:
    repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 26px,transparent 26px 32px),
    repeating-linear-gradient(180deg,rgba(255,255,255,.04) 0 20px,transparent 20px 26px),
    linear-gradient(180deg,#26262E,#0E0E12)}

/* ── The caption ─────────────────────────────────────────────────────────── */
.caption{position:absolute;left:76px;bottom:52px;z-index:5}
.caption .line{font-size:27px;font-weight:450;letter-spacing:-.025em;line-height:1.28}
.caption .line em{font-style:normal;color:var(--ac-2)}
.caption .url{font-size:16px;color:var(--fg-4);margin-top:11px;letter-spacing:.02em}
.stat{position:absolute;right:76px;bottom:52px;z-index:5;text-align:right}
.stat b{display:block;font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1.1}
.stat span{display:block;font-size:13px;color:var(--fg-4);margin-top:7px;
  letter-spacing:.07em;text-transform:uppercase}
/* The caption sits over the desk, which is busy. This lifts it off. */
.scrim{position:absolute;left:0;right:0;bottom:0;height:210px;z-index:4;
  background:linear-gradient(180deg,transparent,rgba(6,6,8,.86) 62%)}
`;

const HTML = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
<div class="wall"></div>
<div class="win"><i class="v"></i><i class="h"></i><u></u></div>
<div class="daylight"></div>

<div class="sign-glow"></div>
<div class="sign">
  <div class="mark"><div class="top"><div class="p1"></div><div class="p2"></div></div>
    <div class="concl"></div></div>
  <div class="word">IGITUR</div>
</div>

<div class="desk"></div>
<div class="deskline"></div>

<div class="prop mug"></div>
<div class="prop book"></div>
<div class="prop book2"></div>
<div class="prop kbd"></div>

<div class="screens">
  <div class="mon l">
    <div class="wbar"><div class="wdots"><i></i><i></i><i></i></div>
      <div class="wurl">igitur.xyz/b/compute-is-the-binding-constraint</div></div>
    <div class="wbody">
      <p class="kick">Your book</p>
      <p class="premise">“${book.premise}”</p>
      <div class="tags">
        <span class="tag on">${book.theme}</span>
        <span class="tag">${book.holdings.length} holdings</span>
        <span class="tag">Confidence ${book.confidence}%</span>
      </div>
      <div class="bar">${bar}</div>
    </div>
  </div>

  <div class="mon r">
    <div class="wbar"><div class="wdots"><i></i><i></i><i></i></div>
      <div class="wurl">igitur.xyz/method</div></div>
    <div class="wbody">
      <p class="kick">Every holding, and why it is that size</p>
      <div class="rows">${rows}</div>
    </div>
  </div>
</div>

<div class="scrim"></div>
<div class="caption">
  <p class="line">Write what you believe.<br><em>See what it holds.</em></p>
  <p class="url">igitur.xyz</p>
</div>
<div class="stat">
  <b>${book.themeCount} theses · ${book.nameCount} names</b>
  <span>Every weight carries its reason</span>
</div>

<div class="grain"></div>
<div class="vignette"></div>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const file = join(HERE, "07-workspace.html");
writeFileSync(file, HTML);
await page.goto("file://" + file);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(340);
await page.screenshot({ path: join(HERE, "07-workspace.png") });
await browser.close();
console.log(`07-workspace.png · ${W * 2}×${H * 2}`);
