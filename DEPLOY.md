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

## 1. Server preparation, once

SSH in as root, then:

```bash
# Node 22 + a process manager + a reverse proxy
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs nginx
npm install -g pm2

# A non-root user to run the app
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
NEXT_PUBLIC_SITE_URL=https://igitur.xyz PORT=3000 pm2 start server.js --name igitur
pm2 save
pm2 startup          # run the line it prints, as root, so it survives reboot
```

## 5. Nginx in front

`/etc/nginx/sites-available/igitur.xyz`:

```nginx
server {
    listen 80;
    server_name igitur.xyz www.igitur.xyz;

    location / {
        proxy_pass         http://127.0.0.1:3000;
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
nginx -t && systemctl reload nginx
```

Do **not** add security headers in nginx. The app already sends CSP,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS and
`X-Content-Type-Options` from `next.config.ts`. Setting them in both places
produces duplicates, and browsers apply the most restrictive of each — which
is how sites break in ways that are painful to debug.

## 6. HTTPS

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d igitur.xyz -d www.igitur.xyz
```

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
ssh igitur@31.97.66.123 "pm2 restart igitur"
```

## Before you launch the token

`lib/site.ts` still carries placeholders. The X and Telegram handles
(`@igiturxyz`, `t.me/igiturxyz`) are invented — claim them or change them.
`/token` promises the contract address appears "here and on X at the same
moment, and nowhere else first", and that promise is only as good as your
control of both. Register the obvious lookalike domains too; with the token not
yet deployed, this is the window impersonators target.
