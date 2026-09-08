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
cd /var/www/igitur && git fetch --all && git reset --hard origin/HEAD
bash scripts/update-igitur.sh
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

Without a vendor key the site runs on figures generated from the ticker text and
says so on every page that carries a number. To make them real, put a key on the
server — at runtime, not build time, so this needs no rebuild:

```bash
cat > /var/www/igitur/.env <<'ENV'
MARKET_PROVIDER=fmp
MARKET_API_KEY=your-key-here
ENV
chmod 600 /var/www/igitur/.env
pm2 restart igitur --update-env
```

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

Once the accounts are held, add them to the **build** environment and rebuild:

```bash
cd /var/www/igitur
NEXT_PUBLIC_SITE_URL=https://igitur.xyz \
NEXT_PUBLIC_X_HANDLE=yourhandle \
NEXT_PUBLIC_TELEGRAM_HANDLE=yourhandle \
  npm run build
cp -r .next/static .next/standalone/.next/static
pm2 restart igitur
```

These are `NEXT_PUBLIC_*`, so they are baked in at build time — a restart alone
will not pick them up, unlike `MARKET_API_KEY`.

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
