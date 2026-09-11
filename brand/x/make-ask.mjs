/**
 * The assistant banner — one standalone image for the /ask launch.
 *
 * The workspace banner (make-workspace.mjs) answers "is this a real tool?" by
 * showing it running in a room. This one answers a different question, and it
 * is the only question that matters about an assistant attached to a site about
 * portfolios: what will it not do?
 *
 * So the scene is one exchange, and the exchange is the refusal. "Should I buy
 * NVDA?" is the first thing anybody types into this thing, and the answer on
 * screen is the product's whole position — it declines, says why it declines,
 * and then gives the reader the number it *can* stand behind, with the reason
 * and the judgement that produced it. A banner that showed the assistant being
 * helpful about a ticker would sell the opposite product.
 *
 * ── What makes it read as premium rather than busy ──────────────────────────
 *
 *   One object.  The workspace shot has two monitors and a keyboard. This has a
 *                single panel, further right, tilted a few degrees. Space
 *                around an object is the cheapest luxury there is.
 *
 *   Material.    Same glass-in-metal as the workspace: bright top bezel, a
 *                raking sheen across the glass, a dim reflection under it on
 *                the desk. Consistency across the set matters more than any
 *                one effect.
 *
 *   Restraint.   Two accents only — the answer's left rule and the caret. The
 *                refusal is carried by the words, not by a red badge.
 *
 *   One warm edge against an otherwise blue scene, as everywhere else here.
 *
 * ── Nothing on screen is typed here ─────────────────────────────────────────
 *
 * The weight and its reason come from book.json, which lib/generator wrote.
 * The conviction score is read out of lib/universe.ts and the floor and cap out
 * of lib/reweight.ts, at render time. Change the universe and this banner
 * changes with it; a banner for a product whose claim is "every number is
 * published" cannot carry numbers somebody typed into a design file.
 *
 *   npm run build && node brand/x/make-ask.mjs
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
const lead = book.holdings.find((h) => h.lead) ?? book.holdings[0];

/** Read, never transcribed — see the note above about typed numbers. */
function convictionOf(ticker, themeName) {
  const src = readFileSync(join(ROOT, "lib", "universe.ts"), "utf8");
  const from = src.indexOf(`"${themeName}"`);
  const m = src.slice(from > -1 ? from : 0).match(new RegExp(`a\\("${ticker}",[^,]+,[^,]+,\\s*(\\d+)`));
  if (!m) throw new Error(`no conviction for ${ticker} under ${themeName}`);
  return Number(m[1]);
}
function constOf(name) {
  const src = readFileSync(join(ROOT, "lib", "reweight.ts"), "utf8");
  const m = src.match(new RegExp(`export const ${name} = (\\d+)`));
  if (!m) throw new Error(`no ${name} in lib/reweight.ts`);
  return Number(m[1]);
}

const CONVICTION = convictionOf(lead.t, book.theme);
const FLOOR = constOf("MIN_PCT");
const CAP = constOf("MAX_PCT");

const CSS = `
${faces}
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0A0A0B;--fg:#FAFAFA;--fg-2:#9E9EA6;--fg-3:#8A8A92;--fg-4:#7A7A82;
  --ac:#7C8CFF;--ac-2:#AEB6FF;--bd:rgba(255,255,255,.068);--bd-2:rgba(255,255,255,.115)}
html,body{width:${W}px;height:${H}px}
body{background:#060608;font-family:Inter,system-ui,sans-serif;color:var(--fg);
  -webkit-font-smoothing:antialiased;position:relative;overflow:hidden}

/* ── The room ─────────────────────────────────────────────────────────────
   Same four lights as the workspace banner, moved: the daylight comes from
   the right here so it falls across the panel rather than behind the copy. */
.wall{position:absolute;inset:0;
  background:
    radial-gradient(1200px 720px at 88% -12%,rgba(150,170,255,.12),transparent 60%),
    radial-gradient(1100px 700px at 62% 26%,rgba(124,140,255,.13),transparent 64%),
    radial-gradient(720px 600px at -6% 72%,rgba(255,176,120,.05),transparent 62%),
    linear-gradient(180deg,#101016 0%,#0B0B0F 46%,#070709 100%)}
.daylight{position:absolute;top:-160px;right:-160px;width:720px;height:900px;
  transform:rotate(-16deg);opacity:.5;
  background:linear-gradient(255deg,rgba(196,212,255,.11),rgba(196,212,255,.02) 44%,transparent 68%);
  filter:blur(30px)}
.haze{position:absolute;left:0;right:0;top:440px;height:280px;filter:blur(52px);
  background:linear-gradient(180deg,transparent,rgba(150,168,235,.09) 46%,transparent)}
.grain{position:absolute;inset:0;opacity:.26;mix-blend-mode:overlay;z-index:9;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
.vignette{position:absolute;inset:0;z-index:8;
  background:radial-gradient(128% 94% at 56% 46%,transparent 44%,rgba(0,0,0,.74) 100%)}

/* ── The desk ────────────────────────────────────────────────────────────── */
.desk{position:absolute;left:-10%;right:-10%;bottom:0;height:300px;z-index:2;
  background:linear-gradient(180deg,#22222B 0%,#15151B 26%,#0C0C11 64%,#08080A 100%);
  transform:perspective(1000px) rotateX(58deg);transform-origin:top center;
  box-shadow:0 -1px 0 rgba(255,255,255,.16),0 -44px 120px -30px rgba(124,140,255,.26)}
.deskline{position:absolute;left:0;right:0;bottom:270px;height:1.5px;z-index:3;
  background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.06) 44%,rgba(255,255,255,.30) 62%,rgba(255,255,255,.30) 94%,transparent)}
.pool{position:absolute;bottom:96px;right:3%;width:56%;height:230px;z-index:3;filter:blur(54px);
  background:radial-gradient(closest-side,rgba(174,182,255,.28),transparent)}

/* ── The panel ────────────────────────────────────────────────────────────
   One object, tilted a few degrees, lit along the top bezel. The sheen is
   steep and short: a highlight that covers the glass stops being light and
   becomes a scrim over the thing the banner exists to show. */
.stage{position:absolute;right:72px;bottom:250px;z-index:4;perspective:2000px}
.mon{position:relative;width:800px;border-radius:16px;
  background:linear-gradient(180deg,#141418,#0A0A0D);
  transform:rotateY(-7deg) rotateX(1.4deg);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.30),
    inset 0 0 0 1px rgba(255,255,255,.13),
    0 1px 0 rgba(255,255,255,.06),
    0 80px 140px -46px rgba(0,0,0,1),
    0 0 190px -26px rgba(124,140,255,.60)}
.mon .inner{border-radius:16px;overflow:hidden;position:relative}
.mon .inner::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(166deg,rgba(255,255,255,.085) 0%,rgba(255,255,255,.02) 24%,transparent 44%)}
/* Anchored to the panel's base — 250 - 210 — so the mirror starts where the
   object stops. A reflection that floats is worse than none. */
.reflect{position:absolute;right:72px;bottom:40px;height:210px;z-index:3;perspective:2000px;
  display:flex;align-items:flex-start;justify-content:flex-end;
  transform:scaleY(-1);opacity:.20;filter:blur(4.5px);pointer-events:none;
  -webkit-mask-image:linear-gradient(0deg,#000 8%,transparent 52%)}
.reflect .mon{box-shadow:none}

.wbar{display:flex;align-items:center;gap:12px;padding:12px 15px;
  border-bottom:1px solid var(--bd);background:rgba(255,255,255,.025)}
.wdots{display:flex;gap:6px}
.wdots i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.085);display:block}
.wurl{flex:1;font-size:13px;color:var(--fg-4);background:rgba(255,255,255,.03);border-radius:6px;
  padding:6px 11px;box-shadow:inset 0 0 0 1px var(--bd);white-space:nowrap}
.wbody{padding:22px 24px 20px;background:linear-gradient(180deg,#0D0D10,#0A0A0C)}

/* ── The exchange ─────────────────────────────────────────────────────────
   The site's own two-column turn: who spoke, then what they said. Kept as
   plain text on the ground rather than in bubbles — a chat bubble is a
   messenger app, and this is a page that answers. */
.turn{display:grid;grid-template-columns:74px 1fr;gap:16px;padding:14px 0}
.turn+.turn{border-top:1px solid rgba(255,255,255,.05)}
.who{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-4);
  padding-top:4px}
.turn.a .who{color:var(--ac-2);opacity:.9}
.said{font-size:16.5px;line-height:1.5;letter-spacing:-.014em;font-weight:380;color:#E9E9EE}
.turn.a .said{border-left:2px solid rgba(124,140,255,.55);padding-left:16px;margin-left:-2px}
.said b{font-weight:600;color:#fff}
.said .q{color:var(--fg-2)}
.caret{display:inline-block;width:9px;height:17px;vertical-align:-3px;margin-left:3px;
  background:var(--ac-2);border-radius:1px;box-shadow:0 0 14px rgba(174,182,255,.9)}

.foot{display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:14px;
  border-top:1px solid rgba(255,255,255,.05)}
.field{flex:1;font-size:14px;color:var(--fg-4);background:rgba(255,255,255,.03);
  border-radius:9px;padding:11px 13px;box-shadow:inset 0 0 0 1px var(--bd)}
.send{font-size:13px;font-weight:550;color:#0A0A0B;padding:11px 18px;border-radius:9px;
  background:linear-gradient(180deg,#fff,#D6DAF5);box-shadow:0 0 30px -8px rgba(174,182,255,.8)}

/* ── The copy ─────────────────────────────────────────────────────────────── */
.sign{position:absolute;left:84px;top:96px;z-index:7;display:flex;align-items:center;gap:16px}
.mark{display:flex;flex-direction:column;gap:4.5px;width:30px;
  filter:drop-shadow(0 0 18px rgba(174,182,255,.5))}
.mark .top{display:flex;gap:2.2px;height:6.3px}
.mark .p1{width:15.6px;background:rgba(255,255,255,.46);border-radius:3.2px}
.mark .p2{width:10.9px;background:var(--ac);border-radius:3.2px}
.mark .concl{width:30px;height:8.6px;background:var(--fg);border-radius:4.3px}
.sign .word{font-size:21px;font-weight:600;letter-spacing:.085em;color:#EDEFFF;
  filter:drop-shadow(0 0 22px rgba(174,182,255,.35))}

.copy{position:absolute;left:84px;top:232px;width:560px;z-index:7}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--ac-2);
  opacity:.88}
.head{font-size:58px;font-weight:500;letter-spacing:-.042em;line-height:1.06;margin-top:22px}
.head em{font-style:normal;display:block;
  background:linear-gradient(180deg,#EDEFFF,#A2ADF2);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.deck{font-size:17px;line-height:1.55;color:var(--fg-2);font-weight:350;margin-top:24px;
  max-width:46ch}
.url{font-size:14px;color:var(--fg-4);margin-top:28px;letter-spacing:.14em;text-transform:uppercase}

.stat{position:absolute;left:84px;bottom:64px;z-index:7;display:flex;align-items:flex-end;gap:30px;
  padding-top:26px}
.stat::before{content:"";position:absolute;top:0;left:0;width:430px;height:1px;
  background:linear-gradient(90deg,rgba(255,255,255,.16),transparent)}
.stat .n{font-size:34px;font-weight:600;letter-spacing:-.035em;line-height:1}
.stat .n span{display:block;font-size:10.5px;color:var(--fg-4);margin-top:9px;
  letter-spacing:.15em;text-transform:uppercase;font-weight:450;white-space:nowrap}
.stat .rule{width:1px;height:48px;background:linear-gradient(180deg,transparent,var(--bd-2),transparent)}
.scrim{position:absolute;left:0;right:0;bottom:0;height:260px;z-index:6;
  background:linear-gradient(180deg,transparent,rgba(5,5,7,.88) 60%)}
`;

/** One panel, written once: the reflection is the same object, not a copy. */
const PANEL = `<div class="mon"><div class="inner">
  <div class="wbar"><div class="wdots"><i></i><i></i><i></i></div>
    <div class="wurl">igitur.xyz/ask</div></div>
  <div class="wbody">
    <div class="turn"><div class="who">You</div>
      <p class="said q">Should I buy ${lead.t}?</p></div>
    <div class="turn a"><div class="who">Igitur</div>
      <p class="said">No — and not out of caution. I do not know your position, your horizon
        or your circumstances, and I hold no price data at all. What I can tell you is why
        <b>${lead.t} is ${lead.pct}%</b> of this portfolio: conviction <b>${CONVICTION}</b>, because
        &ldquo;${lead.why}&rdquo;</p></div>
    <div class="turn"><div class="who">You</div>
      <p class="said q">Who decided ${CONVICTION}?</p></div>
    <div class="turn a"><div class="who">Igitur</div>
      <p class="said">A person did, and it is published. Conviction is an editorial judgement,
        not model output — which is why it sits on a page you can argue with. A formula turns it
        into the weight, floored at ${FLOOR}% and capped at ${CAP}% so no one name runs<span class="caret"></span></p></div>
    <div class="foot">
      <div class="field">Ask about a thesis, a weight, or how any of it works</div>
      <div class="send">Ask</div>
    </div>
  </div></div></div>`;

const HTML = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
<div class="wall"></div>
<div class="daylight"></div>
<div class="haze"></div>

<div class="desk"></div>
<div class="deskline"></div>
<div class="pool"></div>

<div class="reflect">${PANEL}</div>
<div class="stage">${PANEL}</div>

<div class="sign">
  <div class="mark"><div class="top"><div class="p1"></div><div class="p2"></div></div>
    <div class="concl"></div></div>
  <div class="word">IGITUR</div>
</div>

<div class="scrim"></div>
<div class="copy">
  <p class="eyebrow">New — the assistant</p>
  <h1 class="head">Ask it anything.<em>It still won&rsquo;t tell you what to buy.</em></h1>
  <p class="deck">No tools, no search, no memory of you. It answers only from the
    ${book.themeCount} published theses and the methodology behind every weight — and says so
    plainly when the answer is not in there.</p>
  <p class="url">igitur.xyz/ask</p>
</div>
<div class="stat">
  <div class="n">${book.themeCount}<span>Written theses</span></div>
  <div class="rule"></div>
  <div class="n">${book.nameCount}<span>Names with a reason</span></div>
  <div class="rule"></div>
  <div class="n">0<span>Recommendations, ever</span></div>
</div>

<div class="vignette"></div>
<div class="grain"></div>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const file = join(HERE, "08-ask.html");
writeFileSync(file, HTML);
await page.goto("file://" + file);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(340);
await page.screenshot({ path: join(HERE, "08-ask.png") });
await browser.close();
console.log(`08-ask.png · ${W * 2}×${H * 2}`);
