#!/usr/bin/env bash
#
# Terapkan .env yang baru TANPA membangun ulang.
#
#   bash /var/www/igitur/scripts/reload-env-igitur.sh
#
# Kenapa ini ada: MARKET_API_KEY dibaca saat runtime, tapi pm2 hanya menerima
# nilainya lewat perintah start di update-igitur.sh. Mengubah .env lalu
# menjalankan update-igitur.sh berakhir di "sudah terbaru" — skrip itu keluar
# sebelum sampai ke langkah restart, jadi kunci baru tidak pernah terpakai dan
# yang terlihat adalah "sudah saya ganti tapi tetap salah".
#
# Ini membaca .env, me-restart pm2 dengan isinya, lalu MEMBUKTIKAN hasilnya
# lewat /api/market-probe — bukan menganggap.
#
set -euo pipefail

APP="${APP:-/var/www/igitur}"
DOMAIN="${DOMAIN:-igitur.xyz}"
PM2_NAME="${PM2_NAME:-igitur}"
NGINX_DIR="${NGINX_DIR:-/etc/nginx/sites-enabled}"

FAILED_CMD=""; FAILED_LINE=""; DIED=""
trap 'FAILED_CMD=$BASH_COMMAND; FAILED_LINE=$LINENO' ERR
trap 'rc=$?; if [ "$rc" -ne 0 ] && [ -z "$DIED" ]; then
        printf "\n\033[1;31mBERHENTI mendadak di baris %s (kode %s):\n  %s\033[0m\n" \
          "${FAILED_LINE:-?}" "$rc" "${FAILED_CMD:-?}" >&2
      fi' EXIT

say()  { printf '\n\033[1;36m=== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die()  { DIED=1; printf '\n\033[1;31mBERHENTI: %s\033[0m\n' "$*" >&2; exit 1; }

pm2 describe "$PM2_NAME" >/dev/null 2>&1 || die "pm2 tidak mengenal '$PM2_NAME'."

# Port dibaca dari nginx, bukan ditebak — ke sanalah lalu lintas sungguhan
# dikirim. -R, bukan -r: sites-enabled berisi symlink.
CONF=$(grep -Rl "server_name .*$DOMAIN" "$NGINX_DIR/" 2>/dev/null | head -1 || true)
[ -n "$CONF" ] || CONF=$(grep -Rl "server_name .*$DOMAIN" /etc/nginx/sites-available/ 2>/dev/null | head -1 || true)
[ -n "$CONF" ] || die "Tidak menemukan blok nginx untuk $DOMAIN."
PORT=$(grep -oE 'proxy_pass +https?://127\.0\.0\.1:[0-9]+' "$CONF" | grep -oE '[0-9]+$' | head -1 || true)
[ -n "$PORT" ] || die "Tidak menemukan proxy_pass di $CONF."
ok "port $PORT (dari nginx)"

say "Membaca .env"
MARKET_ENV=""
if [ -f "$APP/.env" ]; then
  # Allowlist — lihat update-igitur.sh. Variabel yang tidak disebut di sini
  # tidak pernah sampai ke proses, betapapun benar isinya di .env.
  MARKET_ENV=$(grep -E '^(MARKET_(PROVIDER|API_KEY|TTL_S)|TWELVEDATA_API_KEY|ANTHROPIC_API_KEY)=' "$APP/.env" 2>/dev/null | tr '\n' ' ' || true)
fi
# Nilainya tidak pernah dicetak — hanya ada tidaknya, dan panjangnya.
if [ -n "$MARKET_ENV" ]; then
  KEYLEN=$(grep -E '^MARKET_API_KEY=' "$APP/.env" 2>/dev/null | head -1 | sed 's/^MARKET_API_KEY=//' | tr -d '"'"'"' \r\n' | wc -c || echo 0)
  ok "konfigurasi pasar ditemukan (kunci: $((KEYLEN > 0 ? KEYLEN - 1 : 0)) karakter)"
else
  warn "tidak ada MARKET_* di .env — situs akan memakai sumber tanpa kunci"
fi

say "Menyalakan ulang dengan konfigurasi itu"
# shellcheck disable=SC2086
env NEXT_PUBLIC_SITE_URL="https://$DOMAIN" PORT="$PORT" HOSTNAME="127.0.0.1" \
  LEDGER_PATH="$APP/data/ledger.jsonl" MARKET_CACHE_PATH="$APP/data/quotes.json" $MARKET_ENV \
  pm2 restart "$PM2_NAME" --update-env
pm2 save >/dev/null
sleep 4

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:$PORT/" || true)
[ "$code" = "200" ] || die "situs tidak menjawab ($code). Konfigurasi lama masih di .env; perbaiki lalu ulangi."
ok "situs menjawab"

say "Membuktikan"
PROBE=/tmp/igitur-probe.$$.json
curl -s --max-time 40 "http://127.0.0.1:$PORT/api/market-probe" -o "$PROBE" || true
if command -v python3 >/dev/null 2>&1 && [ -s "$PROBE" ]; then
  python3 - "$PROBE" <<'PYEOF' || true
import json, sys
d = json.load(open(sys.argv[1]))
live = d.get("serving") == "real"
steps = d.get("steps", [])
good = [s for s in steps if s.get("ok")]
bad = [s for s in steps if not s.get("ok")]
print(f"    sumber      : {d.get('provider')}")
print(f"    menyajikan  : {d.get('serving')}  (real = harga sungguhan)")
for name, k in (d.get("keys") or {}).items():
    if k.get("configured"):
        print(f"    kunci {name:<9}: {k.get('length')} karakter, terkutip di .env: {k.get('quotedInEnv')}")
# Menggulung yang gagal hanya sah kalau sumber UTAMA yang menjawab. Kalau
# "real" datang dari cache disk sementara vendornya sendiri gagal, alasan
# kegagalan itu justru yang paling perlu dibaca — menyembunyikannya adalah
# kesalahan yang sama dengan laporan yang selalu merah, dari arah sebaliknya.
primary = str(d.get("provider") or "")
primary_ok = any(s.get("ok") and str(s.get("step") or "").startswith(primary) for s in steps)
if live and primary_ok:
    for s in good:
        print(f"    [  ok ] {str(s.get('step')):<11} HTTP {s.get('status'):<4} {s.get('detail')}")
    if bad:
        names = ", ".join(str(s.get("step")) for s in bad)
        print(f"    cadangan    : {len(bad)} tidak terpakai ({names})")
        print( "                  wajar: hanya dipanggil kalau sumber utama berhenti menjawab.")
else:
    if live:
        print( "    catatan     : angka nyata datang dari simpanan di disk, bukan dari")
        print( "                  vendor barusan. Alasan vendor gagal ada di bawah.")
    err = d.get("lastVendorError")
    if err:
        print(f"    kesalahan   : {err}")
    for s in steps:
        mark = "  ok " if s.get("ok") else "GAGAL"
        print(f"    [{mark}] {str(s.get('step')):<11} HTTP {s.get('status'):<4} {s.get('detail')}")
PYEOF
else
  cat "$PROBE" 2>/dev/null || true
  echo
fi
rm -f "$PROBE"
echo
echo "  Kalau 'menyajikan' masih generated, barisnya sendiri yang menyebut alasannya."
