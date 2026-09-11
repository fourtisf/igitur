/**
 * The launch card — the contract address, as an image.
 *
 * This one has a job the others do not: it is what somebody screenshots and
 * compares against the address in front of them before they trade. So the
 * address is the subject, not a footnote — set large, in monospace, split into
 * groups the eye can check, with the last four called out because that is the
 * half of the string lookalike addresses never match.
 *
 * It is deliberately quieter than the workspace and assistant banners. A launch
 * card that looks like an advertisement is the aesthetic every fake token uses;
 * this one should read like a notice board.
 *
 * The address is read from lib/site.ts at render time and appears nowhere else
 * in this repository — tests/honesty.test.ts fails the build if a second copy
 * shows up, this file included.
 *
 *   npm run build && node brand/x/make-token.mjs
 */
import { chromium } from "playwright";
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const W = 1600;
const H = 900;

const site = readFileSync(join(ROOT, "lib", "site.ts"), "utf8");
const pick = (key) => {
  const m = site.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  if (!m) throw new Error(`no ${key} in lib/site.ts`);
  return m[1];
};
const ADDRESS = pick("contractAddress");
const TICKER = pick("ticker");
const SUPPLY = pick("supply");
const CHAIN = pick("chain");
const HANDLE = "@" + (site.match(/x:\s*"https:\/\/x\.com\/([^"]+)"/)?.[1] ?? "Igiturapp");

if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS)) throw new Error("that is not an address");

/**
 * Unbroken, exactly as it is everywhere else.
 *
 * An earlier version grouped it into sixes, which reads beautifully and is the
 * wrong call for this one field: the reader is comparing this image against a
 * string in their wallet, and an address that is spaced here and unspaced there
 * makes a mismatch easier to miss, not harder. The only concession is the last
 * four set in white — that is the half a lookalike address cannot copy, and it
 * is where a comparison should end.
 */
const HEAD = ADDRESS.slice(0, 2);
const BODY = ADDRESS.slice(2, -4);
const TAIL = ADDRESS.slice(-4);

const MEDIA = join(ROOT, ".next", "static", "media");
const faces = readdirSync(MEDIA)
  .filter((f) => f.endsWith(".woff2"))
  .map((f) => `@font-face{font-family:Inter;src:url("file://${join(MEDIA, f)}") format("woff2");font-weight:100 900;font-display:block}`)
  .join("\n");

const CSS = `
${faces}
*{margin:0;padding:0;box-sizing:border-box}
:root{--fg:#FAFAFA;--fg-2:#9E9EA6;--fg-3:#8A8A92;--fg-4:#7A7A82;
  --ac:#7C8CFF;--ac-2:#AEB6FF;--bd:rgba(255,255,255,.075);--bd-2:rgba(255,255,255,.13)}
html,body{width:${W}px;height:${H}px}
body{background:#08080A;font-family:Inter,system-ui,sans-serif;color:var(--fg);
  -webkit-font-smoothing:antialiased;position:relative;overflow:hidden;
  display:flex;flex-direction:column;justify-content:center;padding:0 96px}

/* One light, from above. A launch card with a sunset gradient behind it is the
   house style of every token that turned out to be nothing. */
.wash{position:absolute;inset:0;
  background:
    radial-gradient(1200px 620px at 50% -18%,rgba(124,140,255,.15),transparent 62%),
    linear-gradient(180deg,#0E0E13 0%,#0A0A0D 52%,#08080A 100%)}
.grain{position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay;z-index:9;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
.vignette{position:absolute;inset:0;z-index:8;
  background:radial-gradient(120% 86% at 50% 42%,transparent 52%,rgba(0,0,0,.66) 100%)}
.shell{position:relative;z-index:7}

.top{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:15px}
.mark{display:flex;flex-direction:column;gap:4.5px;width:30px;
  filter:drop-shadow(0 0 18px rgba(174,182,255,.45))}
.mark .row{display:flex;gap:2.2px;height:6.3px}
.mark .p1{width:15.6px;background:rgba(255,255,255,.46);border-radius:3.2px}
.mark .p2{width:10.9px;background:var(--ac);border-radius:3.2px}
.mark .concl{width:30px;height:8.6px;background:var(--fg);border-radius:4.3px}
.word{font-size:20px;font-weight:600;letter-spacing:.085em;color:#EDEFFF}
.live{display:inline-flex;align-items:center;gap:9px;padding:8px 17px;border-radius:99px;
  font-size:13px;font-weight:600;letter-spacing:.12em;color:var(--ac-2);
  background:rgba(124,140,255,.13);box-shadow:inset 0 0 0 1px rgba(124,140,255,.34)}
.live i{width:7px;height:7px;border-radius:50%;background:var(--ac-2);display:block;
  box-shadow:0 0 12px rgba(174,182,255,.95)}

.tick{font-size:82px;font-weight:600;letter-spacing:-.045em;line-height:1;margin-top:46px}
.tick em{font-style:normal;
  background:linear-gradient(180deg,#EDEFFF,#A2ADF2);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.lede{font-size:17.5px;color:var(--fg-2);margin-top:18px;font-weight:350;max-width:86ch;line-height:1.55}

/* The subject of the card. Monospace, grouped, and the tail set apart — the
   six characters at the front are what a lookalike address copies, the four at
   the end are what it cannot. */
.label{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--fg-4);margin-top:42px}
.addr{margin-top:14px;padding:26px 30px;border-radius:15px;
  background:rgba(255,255,255,.028);
  box-shadow:inset 0 0 0 1px var(--bd-2),0 0 90px -30px rgba(124,140,255,.55);
  font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;
  font-size:30px;letter-spacing:.012em;color:#E7E8EE;white-space:nowrap}
.addr b{color:#fff;font-weight:600;
  text-shadow:0 0 26px rgba(174,182,255,.6)}
.addr u{text-decoration:none;color:var(--fg-3)}

.facts{display:flex;gap:52px;margin-top:34px;align-items:flex-end}
.facts b{display:block;font-size:25px;font-weight:600;letter-spacing:-.02em}
.facts span{display:block;font-size:11px;letter-spacing:.15em;text-transform:uppercase;
  color:var(--fg-4);margin-top:9px}
.rule{width:1px;height:46px;background:linear-gradient(180deg,transparent,var(--bd-2),transparent)}

.warn{margin-top:38px;padding-left:18px;border-left:2px solid rgba(255,138,124,.55);
  font-size:15.5px;line-height:1.62;color:var(--fg-2);max-width:104ch}
.warn b{color:#fff;font-weight:550}
.url{position:absolute;right:96px;bottom:56px;z-index:7;font-size:14px;color:var(--fg-4);
  letter-spacing:.14em;text-transform:uppercase}
`;

const HTML = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
<div class="wash"></div>
<div class="shell">
  <div class="top">
    <div class="brand">
      <div class="mark"><div class="row"><div class="p1"></div><div class="p2"></div></div>
        <div class="concl"></div></div>
      <div class="word">IGITUR</div>
    </div>
    <span class="live"><i></i>LIVE ON ${CHAIN.toUpperCase()}</span>
  </div>

  <h1 class="tick">$<em>${TICKER}</em></h1>
  <p class="lede">The research tool is free and stays free. The tokenomics went up months before
    this contract existed — same page, unchanged — so they can be held against us now that it does.</p>

  <p class="label">Contract address</p>
  <div class="addr"><u>${HEAD}</u>${BODY}<b>${TAIL}</b></div>

  <div class="facts">
    <div><b>${SUPPLY === "1B" ? "1 billion" : SUPPLY}</b><span>Fixed supply</span></div>
    <div class="rule"></div>
    <div><b>None</b><span>Presale · whitelist · team wallet</span></div>
    <div class="rule"></div>
    <div><b>26 · 160</b><span>Theses · names, already live</span></div>
  </div>

  <p class="warn">Published on <b>igitur.xyz/token</b> and by <b>${HANDLE}</b> at the same moment, and
    nowhere else first. <b>Any address that does not match this one is fake</b> — in replies, DMs,
    search results and lookalike sites. Nobody from this project will ever message you first.</p>
</div>
<p class="url">igitur.xyz/token</p>
<div class="vignette"></div>
<div class="grain"></div>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const file = join(HERE, "09-token.html");
writeFileSync(file, HTML);
await page.goto("file://" + file);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(320);
await page.screenshot({ path: join(HERE, "09-token.png") });
await browser.close();
console.log(`09-token.png · ${W * 2}×${H * 2}`);
