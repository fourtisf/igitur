/**
 * The workspace banner — one standalone image for a post or a pinned tweet.
 *
 * The five thread cards (make-thread.mjs) are typographic: a claim, a figure,
 * the bar. This one is a scene, because a scene answers a different question.
 * A stranger scrolling past has no idea this is a working tool rather than a
 * landing page, and the fastest way to say so is to show it running on a screen
 * in a room, the way every developer-tool banner does.
 *
 * ── What makes it read as a product shot rather than a diagram ───────────────
 *
 * Four things, and none of them is "more glow":
 *
 *   Material.  A screen is glass in a metal frame. It gets a bright top bezel
 *              edge where the room lands on it and a raking sheen across the
 *              glass. Without those a monitor is a rounded rectangle.
 *
 *   Reflection. The desk mirrors both screens — the same markup, flipped,
 *              blurred and faded out. This is the single largest difference
 *              between this and the version before it, and it is why the desk
 *              now reads as a surface with things standing on it.
 *
 *   Depth of field. The second monitor sits further away, so it is smaller,
 *              dimmer and very slightly out of focus. Two equally sharp panels
 *              read as a slide; one sharp and one soft reads as a photograph.
 *
 *   Warm against cool. A low amber bounce from the right. The scene is almost
 *              entirely blue, and a single warm edge is what stops that
 *              reading as a colour cast.
 *
 * ── What it deliberately does not have ───────────────────────────────────────
 *
 * A person. The banners this imitates are AI-generated photographs of someone
 * at a desk, and a fake human rendered in CSS lands somewhere between uncanny
 * and cheap. The room carries the same message without one.
 *
 * Detailed props. The mug, the notebooks and the drawn-on key grid that stood
 * here read as placeholder shapes the moment anything else got refined. What is
 * left is one keyboard silhouette, lit along its top edge only and sitting
 * mostly inside the reflection — implied rather than modelled.
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
body{background:#060608;font-family:Inter,system-ui,sans-serif;color:var(--fg);
  -webkit-font-smoothing:antialiased;position:relative;overflow:hidden}

/* ── The room ──────────────────────────────────────────────────────────────
   Four lights, in the order a room has them: daylight from a window off left,
   the sign's own output, the spill the screens throw back, and one warm bounce
   from the right. The warm one is doing more work than its opacity suggests —
   the scene is otherwise entirely blue, and without something warm to sit
   against, blue reads as a colour cast rather than as a choice. */
.wall{position:absolute;inset:0;
  background:
    radial-gradient(1300px 760px at 10% -14%,rgba(150,170,255,.11),transparent 60%),
    radial-gradient(1000px 660px at 50% 20%,rgba(124,140,255,.14),transparent 64%),
    radial-gradient(760px 620px at 104% 62%,rgba(255,176,120,.055),transparent 62%),
    linear-gradient(180deg,#101016 0%,#0B0B0F 46%,#070709 100%)}
.daylight{position:absolute;top:-140px;left:-180px;width:780px;height:920px;
  transform:rotate(18deg);opacity:.55;
  background:linear-gradient(105deg,rgba(196,212,255,.11),rgba(196,212,255,.02) 44%,transparent 68%);
  filter:blur(28px)}
/* Air. A shallow band of haze where the wall meets the desk, which is what
   separates "far" from "near" once everything is the same colour. */
.haze{position:absolute;left:0;right:0;top:430px;height:280px;filter:blur(52px);
  background:linear-gradient(180deg,transparent,rgba(150,168,235,.10) 46%,transparent)}

.win{position:absolute;left:-70px;top:56px;width:380px;height:720px;border-radius:4px;
  background:linear-gradient(160deg,rgba(150,170,255,.085),rgba(120,140,220,.025) 58%,transparent);
  box-shadow:inset 0 0 0 2px rgba(196,212,255,.10);
  -webkit-mask-image:linear-gradient(180deg,#000 46%,transparent 86%)}
.win i{position:absolute;background:rgba(196,212,255,.085);display:block}
.win i.v{top:0;bottom:0;width:2px;left:50%}
.win i.h{left:0;right:0;height:2px;top:34%}
.win u{position:absolute;left:10px;right:10px;bottom:250px;height:170px;display:block;
  background:
    radial-gradient(2px 2px at 22% 74%,rgba(214,228,255,.55),transparent),
    radial-gradient(2px 2px at 58% 52%,rgba(214,228,255,.45),transparent),
    radial-gradient(2px 2px at 78% 82%,rgba(255,206,160,.42),transparent),
    radial-gradient(2px 2px at 38% 90%,rgba(214,228,255,.38),transparent),
    radial-gradient(2px 2px at 88% 62%,rgba(214,228,255,.32),transparent)}

.grain{position:absolute;inset:0;opacity:.26;mix-blend-mode:overlay;z-index:9;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
.vignette{position:absolute;inset:0;z-index:8;
  background:radial-gradient(126% 92% at 50% 44%,transparent 46%,rgba(0,0,0,.72) 100%)}

/* ── The sign ──────────────────────────────────────────────────────────────
   Edge-lit, not glowing. A blurred blob behind a wordmark is the cheapest
   thing on a banner; illuminated signage is crisp at the letterform and soft
   only where it lands on the wall behind it. */
.sign{position:absolute;top:150px;left:50%;transform:translateX(-50%);z-index:2;
  display:flex;align-items:center;gap:26px}
.mark{display:flex;flex-direction:column;gap:7px;width:48px;
  filter:drop-shadow(0 0 22px rgba(174,182,255,.55))}
.mark .top{display:flex;gap:3.5px;height:10px}
.mark .p1{width:24.9px;background:rgba(255,255,255,.46);border-radius:5px}
.mark .p2{width:17.4px;background:var(--ac);border-radius:5px}
.mark .concl{width:48px;height:13.7px;background:var(--fg);border-radius:6.85px}
.sign .word{font-size:46px;font-weight:600;letter-spacing:.085em;
  background:linear-gradient(180deg,#FFFFFF,#D8DCF2 58%,#A8AEC9);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 1px 0 rgba(255,255,255,.28)) drop-shadow(0 0 30px rgba(174,182,255,.42))}
.sign-glow{position:absolute;top:104px;left:50%;transform:translateX(-50%);z-index:1;
  width:700px;height:230px;border-radius:50%;filter:blur(84px);
  background:radial-gradient(closest-side,rgba(124,140,255,.34),transparent)}

/* ── The desk ─────────────────────────────────────────────────────────────
   Dark and slightly glossy, so it can hold a reflection. The bright top edge
   is the wall/desk junction catching the screens. */
.desk{position:absolute;left:-10%;right:-10%;bottom:0;height:340px;z-index:2;
  background:linear-gradient(180deg,#22222B 0%,#15151B 26%,#0C0C11 64%,#08080A 100%);
  transform:perspective(1000px) rotateX(56deg);transform-origin:top center;
  box-shadow:0 -1px 0 rgba(255,255,255,.18),0 -44px 120px -30px rgba(124,140,255,.30)}
.deskline{position:absolute;left:0;right:0;bottom:290px;height:1.5px;z-index:3;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.30) 18%,rgba(255,255,255,.30) 82%,transparent)}
.pool{position:absolute;bottom:92px;height:220px;z-index:3;filter:blur(50px);pointer-events:none}
.pool.a{left:10%;width:46%;background:radial-gradient(closest-side,rgba(174,182,255,.32),transparent)}
.pool.b{right:8%;width:36%;background:radial-gradient(closest-side,rgba(174,182,255,.20),transparent)}

/* ── The monitors ─────────────────────────────────────────────────────────
   Glass in a metal frame. The top bezel highlight and the raking sheen are the
   difference between a monitor and a rounded rectangle; the second unit is
   further away, so it is smaller, dimmer and fractionally out of focus. Two
   equally sharp panels read as a slide, one sharp and one soft as a photo. */
.screens{position:absolute;left:0;right:0;bottom:262px;height:470px;z-index:4;
  display:flex;justify-content:center;align-items:flex-end;gap:32px;perspective:1900px}
.mon{position:relative;border-radius:15px;
  background:linear-gradient(180deg,#141418,#0A0A0D);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.30),
    inset 0 0 0 1px rgba(255,255,255,.13),
    0 1px 0 rgba(255,255,255,.06),
    0 70px 130px -46px rgba(0,0,0,1),
    0 0 150px -34px rgba(124,140,255,.50)}
.mon .inner{border-radius:15px;overflow:hidden;position:relative}
.mon.l{width:790px;transform:rotateY(8deg) rotateX(1.5deg)}
.mon.r{width:598px;transform:rotateY(-9deg) rotateX(1.5deg);
  filter:blur(.7px) brightness(.90) saturate(.96);opacity:.96}
/* The room, raking across the glass. Steep and short — a sheen that covers the
   screen stops being light and becomes a scrim. */
.mon .inner::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(163deg,rgba(255,255,255,.085) 0%,rgba(255,255,255,.02) 26%,transparent 46%)}

.wbar{display:flex;align-items:center;gap:12px;padding:12px 15px;
  border-bottom:1px solid var(--bd);background:rgba(255,255,255,.025)}
.wdots{display:flex;gap:6px}
.wdots i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.085);display:block}
.wurl{flex:1;font-size:13px;color:var(--fg-4);background:rgba(255,255,255,.03);border-radius:6px;
  padding:6px 11px;box-shadow:inset 0 0 0 1px var(--bd);white-space:nowrap}
.wbody{padding:20px 22px 22px;background:linear-gradient(180deg,#0D0D10,#0A0A0C)}

.kick{font-size:11.5px;letter-spacing:.15em;color:var(--fg-4);text-transform:uppercase}
.premise{font-size:19px;line-height:1.34;letter-spacing:-.022em;font-weight:450;margin-top:9px}
.tags{display:flex;gap:6px;margin-top:14px;flex-wrap:wrap}
.tag{font-size:11.5px;padding:5px 10px;border-radius:99px;color:var(--fg-3);
  background:rgba(255,255,255,.03);box-shadow:inset 0 0 0 1px var(--bd)}
.tag.on{color:var(--ac-2);background:rgba(124,140,255,.15);
  box-shadow:inset 0 0 0 1px rgba(124,140,255,.34)}

.bar{display:flex;gap:4px;height:78px;margin-top:16px}
.bar>div{position:relative;display:flex;flex-direction:column;justify-content:flex-end;
  padding:8px 9px 9px;min-width:0;overflow:hidden;border-radius:8px;
  background:linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.04));
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.bar .lead{background:linear-gradient(180deg,#fff,#C9CEFF 55%,#8B95E8);color:#0A0A0B;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.65),0 0 40px -8px rgba(174,182,255,.7)}
.bar .bal{background:linear-gradient(180deg,rgba(124,140,255,.52),rgba(76,88,180,.3));
  box-shadow:inset 0 0 0 1px rgba(124,140,255,.38)}
.bar b{font-size:12px;font-weight:600;display:block;white-space:nowrap}
.bar i{font-style:normal;font-size:10.5px;opacity:.66;display:block;margin-top:2px}

.rows{display:flex;flex-direction:column;gap:2px;margin-top:12px}
.row{display:grid;grid-template-columns:58px 1fr 46px;gap:12px;align-items:baseline;
  padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.03);
  box-shadow:inset 0 0 0 1px var(--bd)}
.row.is-lead{background:rgba(124,140,255,.11);box-shadow:inset 0 0 0 1px rgba(124,140,255,.3)}
.row .t{font-size:13px;font-weight:600;letter-spacing:-.015em}
.row .w{font-size:12px;color:var(--fg-2);font-weight:350;line-height:1.35;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.row .pct{font-size:13px;font-weight:600;text-align:right}

/* ── The reflection ───────────────────────────────────────────────────────
   The same monitors, flipped, blurred and faded. This is the single largest
   difference between this banner and the flat one before it: it is what makes
   the desk a surface with objects standing on it rather than a dark shape
   behind them. Kept dim and short — a mirror-bright reflection is a showroom
   floor, not a desk. */
.reflect{position:absolute;left:0;right:0;bottom:56px;height:206px;z-index:3;
  display:flex;justify-content:center;align-items:flex-start;gap:32px;perspective:1900px;
  transform:scaleY(-1);opacity:.26;filter:blur(3px);pointer-events:none;
  -webkit-mask-image:linear-gradient(0deg,#000 4%,transparent 62%)}
.reflect .mon{box-shadow:none;background:linear-gradient(180deg,#141418,#0A0A0D)}

/* ── Props ────────────────────────────────────────────────────────────────
   One, in silhouette, lit along its top edge only and sitting mostly inside
   the reflection. The mug, the notebooks and the drawn-on key grid that stood
   here read as placeholder shapes the moment anything else got refined. */
.kbd{position:absolute;left:50%;bottom:132px;z-index:5;
  transform:translateX(-50%) perspective(600px) rotateX(60deg);
  width:452px;height:104px;border-radius:11px;
  background:linear-gradient(180deg,#1C1C23,#0B0B0E 62%);
  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.22),inset 0 0 0 1px rgba(255,255,255,.05),
             0 26px 44px -20px rgba(0,0,0,.95)}

/* ── The caption ─────────────────────────────────────────────────────────── */
.scrim{position:absolute;left:0;right:0;bottom:0;height:250px;z-index:6;
  background:linear-gradient(180deg,transparent,rgba(5,5,7,.90) 58%)}
.caption{position:absolute;left:80px;bottom:64px;z-index:7}
.caption .eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--ac-2);opacity:.85;margin-bottom:16px}
.caption .line{font-size:34px;font-weight:500;letter-spacing:-.032em;line-height:1.2}
.caption .line em{font-style:normal;
  background:linear-gradient(180deg,#EDEFFF,#A8B2F5);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.caption .url{font-size:15px;color:var(--fg-4);margin-top:14px;letter-spacing:.13em;
  text-transform:uppercase}
.stat{position:absolute;right:80px;bottom:64px;z-index:7;text-align:right;
  display:flex;align-items:flex-end;gap:34px}
.stat .n{font-size:38px;font-weight:600;letter-spacing:-.035em;line-height:1}
.stat .n span{display:block;font-size:11px;color:var(--fg-4);margin-top:10px;
  letter-spacing:.16em;text-transform:uppercase;font-weight:450;white-space:nowrap}
.stat .rule{width:1px;height:52px;background:linear-gradient(180deg,transparent,var(--bd-2),transparent)}
`;

/** One monitor's markup, so the reflection is the same object and not a
 *  hand-kept copy that drifts the first time a screen changes. */
const MON_L = `<div class="mon l"><div class="inner">
    <div class="wbar"><div class="wdots"><i></i><i></i><i></i></div>
      <div class="wurl">igitur.xyz/b/compute-is-the-binding-constraint</div></div>
    <div class="wbody">
      <p class="kick">Your book</p>
      <p class="premise">&ldquo;${book.premise}&rdquo;</p>
      <div class="tags">
        <span class="tag on">${book.theme}</span>
        <span class="tag">${book.holdings.length} holdings</span>
        <span class="tag">Confidence ${book.confidence}%</span>
      </div>
      <div class="bar">${bar}</div>
    </div></div></div>`;

const MON_R = `<div class="mon r"><div class="inner">
    <div class="wbar"><div class="wdots"><i></i><i></i><i></i></div>
      <div class="wurl">igitur.xyz/method</div></div>
    <div class="wbody">
      <p class="kick">Every holding, and why it is that size</p>
      <div class="rows">${rows}</div>
    </div></div></div>`;

const HTML = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
<div class="wall"></div>
<div class="win"><i class="v"></i><i class="h"></i><u></u></div>
<div class="daylight"></div>
<div class="haze"></div>

<div class="sign-glow"></div>
<div class="sign">
  <div class="mark"><div class="top"><div class="p1"></div><div class="p2"></div></div>
    <div class="concl"></div></div>
  <div class="word">IGITUR</div>
</div>

<div class="desk"></div>
<div class="deskline"></div>
<div class="pool a"></div>
<div class="pool b"></div>

<div class="reflect">${MON_L}${MON_R}</div>
<div class="kbd"></div>
<div class="screens">${MON_L}${MON_R}</div>

<div class="scrim"></div>
<div class="caption">
  <p class="eyebrow">Research you can check</p>
  <p class="line">Write what you believe.<br><em>See what it holds.</em></p>
  <p class="url">igitur.xyz</p>
</div>
<div class="stat">
  <div class="n">${book.themeCount}<span>Written theses</span></div>
  <div class="rule"></div>
  <div class="n">${book.nameCount}<span>Names with a reason</span></div>
</div>

<div class="vignette"></div>
<div class="grain"></div>`;

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
