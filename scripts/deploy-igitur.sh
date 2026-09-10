#!/usr/bin/env bash
#
# Deploy Igitur to igitur.xyz, beside the projects already on this box.
#
# Safe by design: it never stops, edits or deletes anything belonging to
# heirlom, sunmil, nekara or fillmark. It adds one directory, one pm2 process
# and one nginx file. If any step fails it stops rather than continuing.
#
#   bash deploy-igitur.sh
#
set -euo pipefail

# Repositori ini pernah bernama "premise" dan sudah diganti nama menjadi
# "igitur". GitHub masih mengalihkan URL lama, jadi memakainya tetap "jalan" —
# dan itu justru bahayanya: nama `fourtisf/premise` kini bebas didaftarkan siapa
# pun, dan sejak detik itu pengalihannya putus dan skrip ini mengkloning repo
# milik orang asing ke server. Nama yang sekarang, bukan yang mengalihkan.
REPO="https://github.com/fourtisf/igitur.git"
APP="/var/www/igitur"
DOMAIN="igitur.xyz"
PM2_NAME="igitur"

say() { printf '\n\033[1;36m=== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mBERHENTI: %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. Prasyarat, tanpa menginstal ulang apa pun ────────────────────────────
say "1/8  Memeriksa prasyarat"
command -v node  >/dev/null || die "node tidak ada."
command -v nginx >/dev/null || die "nginx tidak ada."
command -v pm2   >/dev/null || die "pm2 tidak ada."
command -v git   >/dev/null || die "git tidak ada."

NODE_MAJOR=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
echo "  node $(node -v), npm $(npm -v), major=$NODE_MAJOR"
if [ "$NODE_MAJOR" -lt 22 ]; then
  die "Igitur butuh Node 22+. Node di sini v$NODE_MAJOR, dan heirlom serta sunmil
       berjalan di atasnya — JANGAN upgrade begitu saja. Beri tahu saya versinya,
       ada cara lain (nvm khusus user igitur, atau turunkan target build)."
fi

# ── 2. Port yang benar-benar bebas ──────────────────────────────────────────
say "2/8  Mencari port bebas"
# Skrip ini memilih port BEBAS. Pada mesin yang igitur-nya sudah jalan, port
# lamanya terpakai, jadi yang terpilih adalah port lain — sementara tahap 7 di
# bawah melewati nginx karena bloknya sudah ada. Hasilnya nginx menunjuk port
# kosong: 502 pada situs yang tadinya sehat. Jadi jangan dipakai memperbarui.
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  die "$PM2_NAME sudah berjalan. Skrip ini untuk pemasangan PERTAMA dan akan
       memindahkan port di belakang nginx. Untuk memperbarui, jalankan:
         bash $APP/scripts/update-igitur.sh"
fi
PORT=""
for p in 3100 3101 3102 3110 3200 4100; do
  if ! ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$p\$"; then PORT=$p; break; fi
done
[ -n "$PORT" ] || die "3100, 3101, 3102, 3110, 3200 dan 4100 semuanya terpakai."
echo "  memakai port $PORT"
echo "  port yang sudah dipakai: $(ss -ltn | awk '{print $4}' | grep -oE '[0-9]+$' | sort -un | tr '\n' ' ')"

# ── 3. Kode ─────────────────────────────────────────────────────────────────
say "3/8  Mengambil kode"
if [ -d "$APP/.git" ]; then
  # Bukan `origin/HEAD` — lihat update-igitur.sh: ref itu tidak dipelihara oleh
  # fetch dan tidak dibuat oleh clone --depth 1, jadi mereset ke sana memakukan
  # pemasangan pada commit lama tanpa sepatah galat pun.
  BRANCH=$(git -C "$APP" symbolic-ref --quiet --short HEAD || true)
  [ -n "$BRANCH" ] || BRANCH=$(git -C "$APP" remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p' | head -1)
  [ -n "$BRANCH" ] || die "Tidak bisa menentukan cabang yang diikuti $APP."
  git -C "$APP" fetch origin "$BRANCH" --quiet
  git -C "$APP" reset --hard "origin/$BRANCH" --quiet
  echo "  diperbarui: $APP (cabang $BRANCH)"
else
  [ -e "$APP" ] && die "$APP sudah ada tapi bukan repo git. Periksa dulu, saya tidak akan menimpanya."
  git clone --depth 1 "$REPO" "$APP"
  echo "  dikloning ke $APP"
fi
echo "  commit: $(git -C "$APP" log --oneline -1)"

# ── 4. Build ────────────────────────────────────────────────────────────────
say "4/8  Membangun (NEXT_PUBLIC_SITE_URL dibakar saat build)"
cd "$APP"
npm ci
# MARKET_OFFLINE: see update-igitur.sh — a build must never spend a vendor's
# daily allowance on pages nobody has asked for yet.
NEXT_PUBLIC_SITE_URL="https://$DOMAIN" MARKET_OFFLINE=1 npm run build

# .next/static tidak ikut ke dalam standalone. Tanpa ini situs terbuka tanpa CSS.
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public || true
echo "  standalone siap: $(du -sh .next/standalone | cut -f1)"

# ── 5. Tes cepat sebelum dijalankan sungguhan ───────────────────────────────
say "5/8  Menjalankan tes"
npm test --silent || die "Tes gagal. Tidak akan men-deploy build yang tidak lulus."

# ── 6. pm2, tanpa mengganggu tetangga ───────────────────────────────────────
say "6/8  Menjalankan lewat pm2"
# Kunci vendor dibaca saat runtime, bukan saat build. Taruh di /var/www/igitur/.env
#   MARKET_PROVIDER=fmp
#   MARKET_API_KEY=...
# Tanpa itu situs jalan dengan angka sintetis dan mengatakannya di setiap halaman.
MARKET_ENV=""
if [ -f "$APP/.env" ]; then
  # shellcheck disable=SC2046
  MARKET_ENV=$(grep -E '^MARKET_(PROVIDER|API_KEY)=' "$APP/.env" | tr '\n' ' ')
  [ -n "$MARKET_ENV" ] && echo "  kunci vendor ditemukan di $APP/.env"
fi
[ -z "$MARKET_ENV" ] && echo "  tanpa kunci vendor — situs memakai angka sintetis dan menyatakannya"
pm2 delete "$PM2_NAME" 2>/dev/null || true
env NEXT_PUBLIC_SITE_URL="https://$DOMAIN" PORT="$PORT" HOSTNAME="127.0.0.1" \
  LEDGER_PATH="$APP/data/ledger.jsonl" MARKET_CACHE_PATH="$APP/data/quotes.json" $MARKET_ENV \
  pm2 start "$APP/.next/standalone/server.js" --name "$PM2_NAME" --cwd "$APP/.next/standalone"
pm2 save
sleep 3
curl -fsS "http://127.0.0.1:$PORT/" -o /dev/null && echo "  aplikasi menjawab di 127.0.0.1:$PORT" \
  || die "Aplikasi tidak menjawab. Lihat: pm2 logs $PM2_NAME --lines 50"

# ── 7. nginx — satu file baru, yang lain tidak disentuh ─────────────────────
say "7/8  Menambah blok nginx"
CONF="/etc/nginx/sites-available/$DOMAIN"
# -R, bukan -r: sites-enabled berisi symlink, dan `grep -r` melewatkannya. Dengan
# -r pemeriksaan ini gagal melihat konfigurasi yang sudah ada, lalu blok di bawah
# menimpa berkas yang sudah disunting certbot — HTTPS mati.
if grep -Rlq "server_name .*$DOMAIN" /etc/nginx/sites-enabled/ /etc/nginx/sites-available/ 2>/dev/null; then
  echo "  $DOMAIN sudah punya blok nginx — dilewati"
else
  cat > "$CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass         http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
    # Header keamanan dikirim oleh aplikasi (next.config.ts). Jangan diulang
    # di sini — duplikat menghasilkan perilaku yang sulit dilacak.
}
NGINX
  ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMAIN"
  echo "  ditulis: $CONF"
fi

# Satu salah ketik di sini menjatuhkan heirlom dan sunmil juga.
nginx -t || die "Konfigurasi nginx tidak valid. TIDAK di-reload — situs lain aman."
# `reload` hanya bekerja pada layanan yang sudah hidup. Di mesin yang nginx-nya
# mati — karena reboot tanpa enable, atau pernah gagal start — reload selalu
# gagal meski konfigurasinya sempurna. Jadi periksa dulu.
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
  echo "  nginx di-reload"
else
  echo "  nginx tidak berjalan — menyalakan"
  systemctl start nginx || die "nginx gagal dinyalakan. Lihat sebabnya:
       systemctl status nginx --no-pager -l
       journalctl -u nginx -n 30 --no-pager"
  systemctl enable nginx >/dev/null 2>&1 || true
  echo "  nginx dinyalakan, dan diaktifkan supaya hidup lagi setelah reboot"
fi

# ── 8. HTTPS ────────────────────────────────────────────────────────────────
say "8/8  Sertifikat"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "  sertifikat sudah ada"
elif ! getent hosts "$DOMAIN" | grep -q "$(curl -fsS4 ifconfig.me 2>/dev/null || echo __)"; then
  echo "  DILEWATI: $DOMAIN belum menunjuk ke server ini. Jalankan setelah DNS menyebar:"
  echo "    certbot --nginx -d $DOMAIN -d www.$DOMAIN"
else
  command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
    echo "  certbot gagal — situs tetap jalan di HTTP. Coba manual: certbot --nginx -d $DOMAIN"
fi

say "SELESAI"
echo "  http://$DOMAIN  (dan https jika sertifikat terbit)"
echo "  port lokal   : $PORT"
echo "  pm2          : $PM2_NAME"
echo
echo "  Tetangga tidak disentuh:"
pm2 list | grep -E "heirlom|sunmil|igitur" || true
