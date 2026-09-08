#!/usr/bin/env bash
#
# Perbarui igitur.xyz yang SUDAH berjalan, di tempat.
#
#   bash /var/www/igitur/scripts/update-igitur.sh
#
# Bedanya dengan deploy-igitur.sh: skrip itu untuk pemasangan pertama dan
# MEMILIH PORT BEBAS. Dijalankan ulang pada situs yang hidup, ia memilih port
# baru sementara nginx masih menunjuk yang lama — 502 di situs yang tadinya
# sehat. Skrip ini justru MEMBACA port dari nginx dan memakai port itu.
#
# Sifatnya:
#   • Build lama disimpan utuh. Kalau versi baru tidak menjawab, dikembalikan
#     dalam hitungan detik — bukan dengan build ulang yang mungkin gagal juga.
#   • Tes harus lulus sebelum apa pun yang hidup disentuh.
#   • nginx, sertifikat, heirlom dan sunmil tidak disentuh sama sekali.
#
set -euo pipefail

# Bisa ditimpa supaya skrip ini bisa dilatih di sandbox sebelum menyentuh
# server sungguhan. Nilai bawaannya adalah pemasangan yang sebenarnya.
APP="${APP:-/var/www/igitur}"
DOMAIN="${DOMAIN:-igitur.xyz}"
PM2_NAME="${PM2_NAME:-igitur}"
NGINX_DIR="${NGINX_DIR:-/etc/nginx/sites-enabled}"

say()  { printf '\n\033[1;36m=== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mBERHENTI: %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. Ini memang pemasangan yang sudah jalan? ──────────────────────────────
say "1/7  Memeriksa pemasangan yang ada"
[ -d "$APP/.git" ] || die "$APP bukan repo git. Untuk pemasangan pertama pakai deploy-igitur.sh."
pm2 describe "$PM2_NAME" >/dev/null 2>&1 || die "pm2 tidak mengenal '$PM2_NAME'. Untuk pemasangan pertama pakai deploy-igitur.sh."

# Port diambil dari nginx, bukan ditebak. Inilah satu-satunya sumber kebenaran:
# ke sinilah lalu lintas sungguhan dikirim.
CONF=$(grep -rl "server_name .*$DOMAIN" "$NGINX_DIR/" 2>/dev/null | head -1)
[ -n "$CONF" ] || die "Tidak menemukan blok nginx untuk $DOMAIN. Jangan diperbarui membabi buta."
PORT=$(grep -oE 'proxy_pass +https?://127\.0\.0\.1:[0-9]+' "$CONF" | grep -oE '[0-9]+$' | head -1)
[ -n "$PORT" ] || die "Tidak bisa membaca port dari $CONF. Periksa manual sebelum lanjut."
ok "nginx  : $CONF → 127.0.0.1:$PORT"
ok "commit : $(git -C "$APP" log --oneline -1)"

# Situs sekarang sehat? Kalau sudah rusak sebelum kita mulai, itu perlu
# diketahui — supaya kerusakan setelahnya tidak salah dituduhkan ke update ini.
if curl -fsS --max-time 10 "http://127.0.0.1:$PORT/" -o /dev/null 2>/dev/null; then
  ok "situs menjawab sebelum diperbarui"
else
  warn "situs TIDAK menjawab sebelum diperbarui — sudah rusak sejak tadi"
fi

# ── 2. Kode ─────────────────────────────────────────────────────────────────
say "2/7  Mengambil kode"
PREV_COMMIT=$(git -C "$APP" rev-parse HEAD)
git -C "$APP" fetch --all --quiet
git -C "$APP" reset --hard origin/HEAD --quiet
NEW_COMMIT=$(git -C "$APP" rev-parse HEAD)
if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  ok "sudah versi terbaru — tidak ada yang perlu dibangun"
  exit 0
fi
ok "dari ${PREV_COMMIT:0:7} ke ${NEW_COMMIT:0:7}"
git -C "$APP" log --oneline "$PREV_COMMIT..$NEW_COMMIT" | sed 's/^/      /'

cd "$APP"

# ── 3. Kunci dan handle ─────────────────────────────────────────────────────
say "3/7  Membaca konfigurasi"
# MARKET_* dibaca saat RUNTIME — cukup restart.
# NEXT_PUBLIC_* dibaca saat BUILD — harus ikut ke perintah build di bawah.
MARKET_ENV=""
BUILD_ENV=""
if [ -f "$APP/.env" ]; then
  MARKET_ENV=$(grep -E '^MARKET_(PROVIDER|API_KEY)=' "$APP/.env" 2>/dev/null | tr '\n' ' ' || true)
  BUILD_ENV=$(grep -E '^NEXT_PUBLIC_[A-Z_]+=' "$APP/.env" 2>/dev/null | tr '\n' ' ' || true)
fi
# Nilainya tidak pernah dicetak — hanya ada tidaknya.
[ -n "$MARKET_ENV" ] && ok "kunci vendor ditemukan" || warn "tanpa kunci vendor — angka tetap sintetis, dan situs mengatakannya"
[ -n "$BUILD_ENV" ]  && ok "variabel build ditemukan" || echo "  tanpa handle sosial — tautan X/Telegram tidak dirender"

# ── 4. Build, dengan yang lama disimpan utuh ────────────────────────────────
say "4/7  Membangun"
npm ci --silent
rm -rf .next.prev
[ -d .next ] && mv .next .next.prev
ok "build lama disimpan di .next.prev"

restore() {
  warn "mengembalikan build lama"
  rm -rf .next
  [ -d .next.prev ] && mv .next.prev .next
  git reset --hard "$PREV_COMMIT" --quiet
  # shellcheck disable=SC2086
  env NEXT_PUBLIC_SITE_URL="https://$DOMAIN" PORT="$PORT" HOSTNAME="127.0.0.1" $MARKET_ENV \
    pm2 restart "$PM2_NAME" --update-env >/dev/null 2>&1 || true
  sleep 3
  if curl -fsS --max-time 10 "http://127.0.0.1:$PORT/" -o /dev/null 2>/dev/null; then
    warn "versi lama hidup kembali — situs aman, update dibatalkan"
  else
    printf '\n\033[1;31mSITUS MASIH MATI setelah dikembalikan. Lihat: pm2 logs %s --lines 60\033[0m\n' "$PM2_NAME" >&2
  fi
}

# shellcheck disable=SC2086
if ! env NEXT_PUBLIC_SITE_URL="https://$DOMAIN" $BUILD_ENV npm run build; then
  restore
  die "Build gagal. Tidak ada yang berubah di situs."
fi

# .next/static tidak ikut ke dalam standalone. Tanpa ini situs terbuka tanpa CSS.
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public
ok "standalone siap: $(du -sh .next/standalone | cut -f1)"

# ── 5. Tes ──────────────────────────────────────────────────────────────────
say "5/7  Menjalankan tes"
if ! npm test --silent; then
  restore
  die "Tes gagal. Situs dikembalikan ke versi sebelumnya."
fi
ok "semua tes lulus"

# ── 6. Menyalakan versi baru ────────────────────────────────────────────────
say "6/7  Menjalankan versi baru"
# restart, bukan delete+start: entri pm2 yang ada dipertahankan berikut portnya.
# shellcheck disable=SC2086
env NEXT_PUBLIC_SITE_URL="https://$DOMAIN" PORT="$PORT" HOSTNAME="127.0.0.1" $MARKET_ENV \
  pm2 restart "$PM2_NAME" --update-env
pm2 save >/dev/null
sleep 4

# ── 7. Membuktikan, bukan menganggap ────────────────────────────────────────
say "7/7  Memverifikasi"
FAIL=0
for path in / /status /universe /trending /token /legal; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:$PORT$path" || true)
  if [ "$code" = "200" ]; then printf '  \033[1;32m✓\033[0m %-12s %s\n' "$path" "$code"
  else printf '  \033[1;31m✗\033[0m %-12s %s\n' "$path" "$code"; FAIL=1; fi
done

if [ "$FAIL" = "1" ]; then
  restore
  die "Versi baru tidak menjawab dengan benar. Sudah dikembalikan."
fi

# Lewat nginx dan TLS, bukan cuma localhost — di situlah pembaca sungguhan ada.
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMAIN/" || true)
[ "$code" = "200" ] && ok "https://$DOMAIN → $code" || warn "https://$DOMAIN → $code (periksa nginx/sertifikat; aplikasinya sendiri sehat)"

rm -rf .next.prev
say "SELESAI"
echo "  commit  : $(git -C "$APP" log --oneline -1)"
echo "  port    : $PORT (tidak berubah)"
echo
echo "  Tetangga tidak disentuh:"
pm2 list | grep -E "heirlom|sunmil|igitur" || true
echo
echo "  Data pasar: buka https://$DOMAIN/status — barisnya jujur sendiri."
