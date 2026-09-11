# Deploying Igitur to igitur.xyz

Your DNS is already correct:

```
A      @      31.97.66.123
CNAME  www    igitur.xyz
```

Nothing below changes those records.

---

## Read this first: shared hosting will not work

Igitur is **not a static site**. Three things need a running Node process:

- `/b/[slug]` and `/track/[slug]` are server-rendered from the premise in the
  query string — that is what makes a shared link crawlable, and it is the whole
  point of the production build.
- `/api/og` renders a PNG per book at request time.
- `sitemap.xml` and `robots.txt` are generated.

`next export` would strip all of it and leave you back where the prototype was.
So the target must be **Hostinger VPS** (Node 22+), not shared/cPanel hosting.
If `31.97.66.123` is a shared plan, upgrade to a VPS first — there is no
workaround that keeps the features.

---

## 0. This box is shared

`31.97.66.123` already runs two other projects — `heirlom-server`, `heirlom-web`,
`sunmil-api` and `sunmil-web` are online under pm2. Everything below is written
so that Igitur lands beside them without touching them.

Three rules follow from that:

- **Do not reinstall Node, nginx or pm2.** They are there and other apps depend
  on them. Check versions instead: `node -v` needs to be 22 or newer.
- **Do not assume port 3000 is free.** Pick one nothing is listening on:
  `ss -ltnp | grep -E ":(3000|3001|3002|3003)"`. This guide uses `3100`; change
  it if that is taken.
- **Do not edit or reset the existing nginx config.** Add one new file for
  igitur.xyz and leave `sites-enabled/` otherwise alone. `nginx -t` before every
  reload — a syntax error takes the other two sites down with yours.

## 1. Server preparation, once

Only what is missing:

```bash
node -v                    # need >= 22; if older, upgrade carefully — the
                           # other apps run on it too
command -v pm2 nginx rsync # all should already be present

# A non-root user, so Igitur cannot reach the other projects' files
adduser --disabled-password --gecos "" igitur
```

## 2. Build — do this on your machine, not the VPS

```bash
npm ci
NEXT_PUBLIC_SITE_URL=https://igitur.xyz npm run build
```

`NEXT_PUBLIC_SITE_URL` is baked in at build time. Build without it and every
canonical link, sitemap entry and og:image will point at the wrong host.

The build emits `.next/standalone` — a self-contained server carrying only the
dependencies it actually uses.

## 3. Upload

Three pieces have to travel together:

```bash
rsync -az --delete .next/standalone/  igitur@31.97.66.123:/home/igitur/app/
rsync -az --delete .next/static/      igitur@31.97.66.123:/home/igitur/app/.next/static/
rsync -az --delete public/            igitur@31.97.66.123:/home/igitur/app/public/
```

`.next/static` and `public/` are **not** inside `standalone`. Skip either one
and the site loads with no CSS and no fonts.

## 4. Run it

```bash
ssh igitur@31.97.66.123
cd ~/app
NEXT_PUBLIC_SITE_URL=https://igitur.xyz PORT=3100 pm2 start server.js --name igitur
pm2 save             # this rewrites the saved list — it will now include
                     # heirlom and sunmil as well, which is what you want
```

`pm2 startup` is already configured on this box for the existing apps; running
it again is unnecessary and can duplicate the systemd unit.

## 5. Nginx in front

A **new** file, `/etc/nginx/sites-available/igitur.xyz`. Do not add this to an
existing site's config:

```nginx
server {
    listen 80;
    server_name igitur.xyz www.igitur.xyz;

    location / {
        proxy_pass         http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/igitur.xyz /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx     # never reload without -t passing first
```

If `nginx -t` fails, fix it before reloading. A bad config does not fail
gracefully — it takes heirlom and sunmil offline along with Igitur.

Do **not** add security headers in nginx. The app already sends CSP,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS and
`X-Content-Type-Options` from `next.config.ts`. Setting them in both places
produces duplicates, and browsers apply the most restrictive of each — which
is how sites break in ways that are painful to debug.

## 5a. Memperbarui situs yang sudah jalan

`deploy-igitur.sh` adalah untuk pemasangan **pertama**. Untuk memperbarui:

```bash
cd /var/www/igitur
bash scripts/update-igitur.sh
```

Cukup itu. **Jangan** menjalankan `git fetch`/`git reset` sendiri lebih dulu —
skripnya sudah melakukannya, dan mendahuluinya pernah membuat versi awal skrip
ini menyimpulkan "tidak ada yang berubah" lalu keluar tanpa membangun. Skrip
sekarang membandingkan commit yang **tercap di dalam build** (`.next/BUILT_COMMIT`)
dengan yang terpasang, jadi mendahuluinya tidak lagi berbahaya — tapi tetap
tidak perlu.

Untuk membangun ulang meski keduanya sama:

```bash
FORCE=1 bash scripts/update-igitur.sh
```

Jangan menjalankan ulang `deploy-igitur.sh` pada situs yang hidup. Ia memilih
port bebas pertama; karena port lama sedang dipakai igitur sendiri, ia akan
memilih port lain — lalu melewati nginx karena bloknya sudah ada. Nginx menunjuk
port kosong dan situs yang tadinya sehat menjadi 502. Skrip itu sekarang menolak
berjalan kalau pm2 sudah mengenal `igitur`, dan menunjuk ke sini.

`update-igitur.sh` justru **membaca** port dari konfigurasi nginx, karena ke
sanalah lalu lintas sungguhan dikirim. Ia juga:

- menyimpan build lama di `.next.prev` sebelum membangun yang baru;
- membatalkan dan mengembalikan build lama kalau build gagal, tes gagal, atau
  versi baru tidak menjawab pada enam rute yang diperiksa — pengembaliannya
  memakai build lama yang sudah jadi, bukan build ulang yang bisa gagal lagi;
- memakai `pm2 restart`, bukan `delete` lalu `start`, sehingga entri pm2 dan
  portnya tetap;
- tidak menyentuh nginx, sertifikat, heirlom, maupun sunmil.

Ketiga jalur kegagalan itu sudah dilatih di sandbox berisi pm2 dan nginx tiruan
dengan aplikasi yang benar-benar berjalan, bukan hanya diperiksa sintaksnya.

## 5b. Market data

With nothing configured the site reads Yahoo's public chart endpoint — no key,
no account, no signup — and shows real prices. Market capitalisation is not in
that response and renders as an em dash. It is not a supported API, so if it
ever starts refusing this server, /status says so and a key moves the site onto
FMP. To make them real, put a key on the
server — at runtime, not build time, so this needs no rebuild:

```bash
cat > /var/www/igitur/.env <<'ENV'
MARKET_PROVIDER=fmp
MARKET_API_KEY=your-key-here
ENV
chmod 600 /var/www/igitur/.env
pm2 restart igitur --update-env
```

The free tier is 250 requests a day. Quotes are therefore cached for an hour,
which costs 96 — one refresh of the universe is 4 requests, and 24 of those fit
comfortably with room for the tracking pages. `MARKET_TTL_S` lowers it on a paid
plan. Do not lower it on the free one: at 60 seconds the allowance is gone
within the hour and the site falls back to synthetic for the rest of the day,
which looks exactly like a key that does not work.

Financial Modeling Prep is the default because it batches: the whole universe
in a handful of requests, which is what makes a free tier workable for a page
that renders 163 tickers. A key is free at
<https://site.financialmodelingprep.com/developer/docs>.

The code calls FMP's `/stable` API. The older `/api/v3` is legacy, is no longer
in the public documentation, and a key created today does not reach it — a
build pointed there returns 403 for every ticker and leaves the site quietly
synthetic.

The pages carrying numbers are prerendered and then regenerated on a timer —
five minutes, and one minute for `/status`. So after a restart the first load
still shows the old page; the next one after that interval has the real
figures. That is the whole delay, and it is why no rebuild is needed.

Confirm it took by loading `/status`. That page does not trust the
configuration: it asks the vendor for one real quote and reports what came
back. Three outcomes, and it distinguishes them:

- **"Live market data from fmp"** — working.
- **"a vendor key is configured but fmp is not answering"** — the key is set and
  being rejected. The line prints the vendor's own response: `401`/`403` is a
  bad key, `402` a plan that excludes batch quotes, `429` the daily quota.
- **"the market data is still synthetic"** — no key is set at all.

Everything else on the site derives its warning the same way, per quote rather
than per site, so a vendor that covers 158 of 163 names flags the other five
instead of letting them pass as real.

## 5c. Social handles

The site links to no social account until one is configured, and says on
`/token` and `/about` that there are no official channels yet. That is the
honest state while the handles are unclaimed — the alternative is a public page
directing people to an account someone else could register, next to a promise
that the token contract address will be announced there.

Both accounts now exist — `@Igiturapp` on X and `t.me/igiturchannel` — and are
defaults in `lib/site.ts`, so a normal deploy picks them up with nothing to
remember. They were environment-only while the handles were still invented;
leaving them that way afterwards would have meant one forgotten variable
silently removing every social link and putting "there are no official channels
yet" back on a site whose channels are real.

`NEXT_PUBLIC_X_HANDLE` and `NEXT_PUBLIC_TELEGRAM_HANDLE` still override, for a
fork or a staging deploy. They are `NEXT_PUBLIC_*`, so they are baked in at
build time — a restart alone will not pick them up, unlike `MARKET_API_KEY`.

## 5d. The record

Committed claims are appended to a plain file, one JSON object per line. It is
the only state the site keeps, and it is not in git — back it up like any other
data you cannot regenerate:

```bash
cat /var/www/igitur/data/ledger.jsonl        # read it
cp  /var/www/igitur/data/ledger.jsonl ~/ledger-$(date +%F).jsonl   # keep a copy
```

`LEDGER_PATH` **must** point outside `.next`. The standalone server's working
directory is `.next/standalone`, and every update replaces `.next` wholesale, so
a ledger left to its default there would be destroyed by the next deploy —
silently. Both deploy scripts set it to `/var/www/igitur/data/ledger.jsonl`, and
the app logs a warning if it ever resolves to a path inside the build output.

The commit endpoint is the only thing on this site that writes. It is guarded
three ways: the claim must produce a book, the same claim is never recorded
twice, and one address may commit five times an hour. The rate limit is in
memory and resets when pm2 restarts, which is the accepted cost of not keeping
another store.

## 5h. Dua berkas simpanan, keduanya di luar `.next`

```
/var/www/igitur/data/quotes.json    harga terakhir per ticker
/var/www/igitur/data/history.json   seri harga harian untuk /track dan /ledger
```

`MARKET_CACHE_PATH` menempatkan yang pertama; yang kedua otomatis di sebelahnya
(`MARKET_HISTORY_PATH` menimpanya kalau perlu). Keduanya **harus** di luar
`.next` — setiap deploy mengganti `.next` seluruhnya.

Kenapa yang kedua ada: `/ledger` mengukur tiap klaim terhadap indeks, dan itu
butuh seri harga per holding — 144 nama sejak 26 tesis Igitur masuk catatan.
Dulu seri itu hanya ada di memori proses. Setiap deploy me-restart proses, dan
langkah verifikasi deploy sendiri membuka `/ledger`, jadi **setiap deploy
membayar ulang 144 nama**. Delapan deploy dalam satu malam menghabiskan 1299
kredit dari jatah 800, dan satu-satunya gejalanya adalah semua sumber menjawab
429.

Jangan hapus dua berkas ini untuk "membersihkan". Menghapusnya berarti membeli
ulang seluruh riwayat dari jatah harian.

## 5f-bis. Matcher model (opsional)

Jangan pernah menempel kunci sebagai argumen perintah — ia akan tersimpan di
riwayat shell. Pakai `read -rs`, yang tidak menggemakan dan tidak masuk riwayat:

```bash
cd /var/www/igitur
umask 077
read -rsp 'Tempel API key, lalu Enter: ' K; echo
touch .env
grep -v '^ANTHROPIC_API_KEY=' .env > .env.tmp
printf 'ANTHROPIC_API_KEY=%s\n' "$K" >> .env.tmp
mv .env.tmp .env
chmod 600 .env
unset K
```

Lalu `bash scripts/reload-env-igitur.sh` — kuncinya dibaca saat **runtime**,
jadi restart sudah cukup dan tidak perlu build ulang.

**Variabel runtime dilewatkan lewat ALLOWLIST**, bukan seluruh isi `.env`.
Variabel yang tidak disebut di regex `MARKET_ENV` pada ketiga skrip tidak akan
pernah sampai ke proses — sudah benar isinya di `.env`, deploy melapor sukses,
dan fiturnya tetap mati tanpa satu pun galat. `ANTHROPIC_API_KEY` sempat
tertinggal persis begitu. `tests/deploy-scripts.test.ts` sekarang memindai
`process.env.*` yang dibaca aplikasi dan menggagalkan build kalau ada yang tidak
ikut dilewatkan.

Tanpa kunci, tidak ada yang berubah: indeks kata kunci menjawab semuanya
seperti biasa, dan `/status` tetap mencantumkan matcher model sebagai belum
dibangun. Dengan kunci, satu hal bertambah — premis yang **ditolak** indeks kata
kunci mendapat pembacaan kedua, dan halaman book mengatakannya sendiri saat itu
terjadi.

Biayanya hanya untuk premis yang ditolak. Jawaban disimpan enam jam, dan
`/api/compose` dibatasi 20 premis per alamat per jam.

Untuk mematikannya lagi: hapus barisnya, restart. Situsnya kembali ke indeks
kata kunci tanpa perubahan lain.

## 5g. Menerbitkan versi baru: satu perintah

```bash
bash /var/www/igitur/scripts/deploy.sh
```

Itu memanggil `update-igitur.sh`, tidak menggantikannya — build, tes dan
rollback tetap milik skrip itu. Yang ditambahkan hanya dua hal yang selama ini
harus diingat manusia, dan sekali terlupa membuat server menyajikan kode
berumur berminggu-minggu tanpa satu pun galat:

1. **Memaksa checkout mengikuti `main`.** Server ini pernah mengikuti cabang
   sesi selama berminggu-minggu sementara setiap update melapor "sudah terbaru"
   dengan benar.
2. **Mengisi catatan, sekali saja.** Hanya berjalan kalau `ledger.jsonl` benar
   -benar kosong, jadi menjalankan skrip ini berulang kali tidak menambah
   klaim duplikat.

Terakhir ia mencetak commit yang benar-benar terpasang dan menanyakan
`https://igitur.xyz/` — bukti, bukan anggapan.

Aman dijalankan berulang. Untuk staging: `BRANCH=coba bash scripts/deploy.sh`.

## 5f. Cabang mana yang disajikan server

Produksi mengikuti `main`, dan kedua skrip menyebut namanya — tidak pernah
menyimpulkannya dari checkout.

Itu bukan kerapian. Server ini pernah mengikuti cabang sesi,
`claude/new-session-ao22yh`, selama berminggu-minggu. Setiap update melapor
"sudah terbaru" dan itu **benar**: cabang tersebut memang tidak bergerak.
Jawabannya tepat, pertanyaannya yang salah. Sekarang skrip memindahkan checkout
ke `main` dan mengatakannya kalau menemukan checkout di tempat lain.

Kalau sebuah pemasangan sudah terlanjur mengikuti cabang lain, sekali ini
perbaiki manual — skrip lama tidak bisa memperbaiki dirinya sendiri, karena bug
itulah yang mencegahnya mengambil perbaikannya:

```bash
cd /var/www/igitur
git remote set-branches origin main
git fetch origin main
git checkout -B main origin/main
git log --oneline -1
```

`git remote set-branches` harus lebih dulu. `git clone --depth 1` membuat klon
satu cabang yang refspec-nya hanya memetakan cabang yang dikloning, jadi tanpa
itu `git fetch origin main` hanya menulis `FETCH_HEAD` dan `origin/main` tidak
pernah ada — persis pesan `fatal: ambiguous argument 'origin/main'`.

Untuk staging, timpa dengan variabel lingkungan:

```bash
BRANCH=coba bash scripts/update-igitur.sh
```

### Seeding it, once, on the first deploy

A new deploy has an empty record, and `/ledger` — the page the rest of the site
exists to fill — reads *"Nothing on the record yet."* A visitor cannot tell that
apart from a site where nothing works.

Fill it with Igitur's own 26 theses, marked `house` so nobody mistakes them for
a reader's conviction:

```bash
cd /var/www/igitur
LEDGER_PATH=/var/www/igitur/data/ledger.jsonl npx tsx scripts/seed-ledger.ts
```

It goes through the same `commit()` the endpoint uses, so every seeded claim is
validated, dated by the server and de-duplicated like any other. Running it
twice adds nothing.

Run it **once, on the first deploy** — not from `update-igitur.sh`. It cannot
backdate: `statedAt` is the server's date at the moment of the write, so a
second run weeks later would add the same 26 claims again with a later
settlement date. That is a different claim, correctly, and not what you want in
the record.

## 5e. The contract address, after launch

Until the token exists there is no strip. `components/TokenStrip.tsx` renders
nothing while `contractAddress` is null: a research tool that opens by
advertising an unlaunched token reads as a token wearing a research tool, and
the warning it carried is stated in full on `/token`, on `/legal` and in a line
on the landing page that links to both.

On launch day, one line in `lib/site.ts` turns the strip on and publishes the
address everywhere at once — the strip and `/token` read the same value:

```ts
contractAddress: "0x…" as string | null,
```

That single edit also brings the strip back across every page, offset included
— there is no separate flag to remember, which is the point. The moment an
address exists is the moment someone can pass off a fake one, and that is when
a fixed, unmissable place to check it starts being worth its space.

The strip then shows the address and its own line changes to *Verify it here
before you trade anything*. Nothing else needs editing, which is the point:
/token promises the address appears here and on X at the same moment and
nowhere else first, and that is only keepable if publishing it is a single
change rather than three that can drift.

It needs a rebuild — `bash scripts/update-igitur.sh` after pushing.

## 6. HTTPS

```bash
# certbot is likely already installed for the other domains
command -v certbot || apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d igitur.xyz -d www.igitur.xyz
```

Certbot only rewrites the server block matching these names, so the other
sites' certificates are untouched.

This matters beyond the padlock: the app sends HSTS with `preload`, which is
meaningless — and browsers ignore it — until the site actually serves HTTPS.

## 7. Redirect www to the apex

Two hostnames serving identical content splits your search ranking and gives a
lookalike-domain story to anyone impersonating you. Pick the apex and send www
to it. After certbot has written its block, add:

```nginx
server {
    listen 443 ssl;
    server_name www.igitur.xyz;
    return 301 https://igitur.xyz$request_uri;
}
```

## 8. Verify — do not skip this

```bash
curl -sI https://igitur.xyz | grep -iE "content-security|x-frame|strict-transport"
curl -s  https://igitur.xyz/method | grep -o 'rel="canonical" href="[^"]*"'
curl -sI "https://igitur.xyz/api/og?page=home" | grep -i content-type
curl -s  https://igitur.xyz/robots.txt
```

Expect: the security headers present, the canonical reading
`https://igitur.xyz/method`, the OG route returning `image/png`, and robots
pointing at `https://igitur.xyz/sitemap.xml`. A canonical that still says
`priori.app` or `premise.app` means step 2 was built without the env var.

Then paste a book URL into the X post composer and confirm the card renders.

---

## Redeploying

```bash
NEXT_PUBLIC_SITE_URL=https://igitur.xyz npm run build
rsync -az --delete .next/standalone/ igitur@31.97.66.123:/home/igitur/app/
rsync -az --delete .next/static/     igitur@31.97.66.123:/home/igitur/app/.next/static/
ssh igitur@31.97.66.123 "pm2 restart igitur"   # named, so the other apps
                                              # are not restarted
```

## Before you launch the token

`lib/site.ts` still carries placeholders. The X and Telegram handles
(`@igiturxyz`, `t.me/igiturxyz`) are invented — claim them or change them.
`/token` promises the contract address appears "here and on X at the same
moment, and nowhere else first", and that promise is only as good as your
control of both. Register the obvious lookalike domains too; with the token not
yet deployed, this is the window impersonators target.
