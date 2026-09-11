#!/usr/bin/env bash
#
# Pasang ANTHROPIC_API_KEY — diuji dulu, ditulis kemudian.
#
#   bash /var/www/igitur/scripts/set-key-igitur.sh
#
# Kenapa ini ada: kunci yang salah satu karakter terlihat persis seperti fitur
# yang rusak. /ask menjawab "tidak bisa", /compare diam-diam kembali menolak
# premis, dan /status tetap bilang model aktif — karena "aktif" di sana berarti
# "ada kunci di .env", bukan "kuncinya diterima". Satu sore hilang untuk itu.
#
# Jadi urutannya dibalik. Kunci diketik, DIUJI ke API, dan baru ditulis ke .env
# kalau API menerimanya. Kunci yang ditolak tidak pernah sampai ke server, dan
# .env yang lama tidak tersentuh.
#
# Kuncinya tidak pernah muncul di layar, di ~/.bash_history, atau di daftar
# proses: dibaca dengan `read -rs`, dikirim lewat konfigurasi curl di stdin,
# bukan lewat argumen.
#
set -euo pipefail

APP="${APP:-/var/www/igitur}"
DOMAIN="${DOMAIN:-igitur.xyz}"
ENV_FILE="${ENV_FILE:-$APP/.env}"
NAME="${KEY_NAME:-ANTHROPIC_API_KEY}"
API="${ANTHROPIC_API_BASE:-https://api.anthropic.com}"
MODEL="${ASK_MODEL:-claude-opus-5}"

say()  { printf '\n\033[1;36m=== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mBERHENTI: %s\033[0m\n' "$*" >&2; exit 1; }
# Bentuk yang sama dengan konsol: awalan, lalu empat karakter terakhir.
mask() { if [ "${#1}" -ge 24 ]; then printf '%s...%s' "${1:0:16}" "${1: -4}"; else printf '%s karakter' "${#1}"; fi; }

[ -d "$APP" ] || die "tidak ada $APP di server ini."

# Apa yang sudah terpasang, dalam bentuk yang bisa dibandingkan dengan konsol.
# Konsol Anthropic hanya menampilkan kunci dalam bentuk terpotong —
# sk-ant-api03-AeO...SQAA — dan empat karakter terakhir itu cukup untuk
# menjawab pertanyaan yang benar: apakah yang terpasang ini kunci yang SAMA
# dengan yang di konsol (berarti salah ketik di tengah), atau kunci yang
# berbeda sama sekali. Hanya tampil di terminal server, tidak di halaman mana
# pun: /api/ask cukup melaporkan panjang dan awalan yang memang seragam.
say "Yang terpasang sekarang"
CURRENT=""
if [ -f "$ENV_FILE" ]; then
  CURRENT=$(grep "^${NAME}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)
fi
if [ -z "$CURRENT" ]; then
  warn "belum ada $NAME di $ENV_FILE"
elif [ "${#CURRENT}" -ge 24 ]; then
  ok "${#CURRENT} karakter — $(mask "$CURRENT")"
  printf '    Bandingkan ekor 4 karakter itu dengan yang di console.anthropic.com.\n'
  printf '    Beda  → yang terpasang memang kunci lain.\n'
  printf '    Sama  → kuncinya benar tapi ada karakter salah di tengah.\n'
else
  warn "${#CURRENT} karakter — terlalu pendek untuk kunci yang sah"
fi

say "Kunci"
if [ "${SHOW_KEY:-}" = "1" ] && [ -t 0 ]; then
  # Untuk kunci yang harus DIKETIK ULANG, bukan ditempel — dari foto layar,
  # misalnya. Mengetik 108 karakter tanpa bisa melihat layar adalah cara
  # tercepat membuat kesalahan kedua setelah kesalahan pertama, dan kunci yang
  # sudah pernah tampil di sebuah gambar tidak menjadi lebih rahasia dengan
  # disembunyikan di sini. Tetap harus diminta, jadi tidak pernah kebetulan.
  warn "SHOW_KEY=1 — kunci akan TERLIHAT di layar. Pastikan tidak ada yang merekam."
  printf '  Ketik atau tempel kunci %s lalu Enter: ' "$NAME"
  read -r RAW
elif [ -t 0 ]; then
  # Tanpa echo. Tempel lalu Enter — tidak ada yang tampil, itu memang benar.
  printf '  Tempel kunci %s lalu Enter (tidak akan terlihat): ' "$NAME"
  read -rs RAW
  printf '\n'
else
  # Dari pipa: dipakai tes, dan berguna kalau kunci datang dari brankas.
  read -r RAW || true
fi

# Rapikan hasil tempelan sebelum menilainya: spasi di ujung, tanda kutip yang
# ikut tersalin, dan CR dari papan klip Windows adalah tiga kesalahan tempel
# yang paling sering, dan ketiganya membuat kunci yang benar ditolak.
KEY=$(printf '%s' "$RAW" | tr -d '\r')
KEY="${KEY#"${KEY%%[![:space:]]*}"}"
KEY="${KEY%"${KEY##*[![:space:]]}"}"
case "$KEY" in
  \"*\") KEY="${KEY#\"}"; KEY="${KEY%\"}"; warn "tanda kutip ikut tertempel — saya buang" ;;
  \'*\') KEY="${KEY#\'}"; KEY="${KEY%\'}"; warn "tanda kutip ikut tertempel — saya buang" ;;
esac

[ -n "$KEY" ] || die "tidak ada yang diketik."
case "$KEY" in
  sk-ant-*) ;;
  *) die "kunci tidak dimulai dengan sk-ant- (${#KEY} karakter). Salah salin?" ;;
esac
case "$KEY" in
  *[!A-Za-z0-9_-]*) die "kunci memuat karakter di luar huruf, angka, - dan _. Salah salin?" ;;
esac
ok "${#KEY} karakter — $(mask "$KEY")"
# Pertanyaan yang paling sering tidak terjawab sesudah 401 adalah "apa bedanya
# dengan yang tadi". Kalau tidak ada bedanya sama sekali, itulah jawabannya.
SAME=""
if [ -n "$CURRENT" ] && [ "$KEY" = "$CURRENT" ]; then
  SAME=1
  warn "persis sama dengan yang sudah terpasang"
fi

say "Menguji ke API sebelum menyentuh .env"
BODY=$(mktemp); OUT=$(mktemp)
trap 'rm -f "$BODY" "$OUT"' EXIT
chmod 600 "$BODY" "$OUT"
printf '{"model":"%s","max_tokens":16,"messages":[{"role":"user","content":"ok"}]}' "$MODEL" > "$BODY"

# Kunci lewat stdin, bukan argumen: argumen terbaca siapa pun yang menjalankan
# `ps` di mesin ini.
CODE=$(printf 'url = "%s/v1/messages"\nheader = "x-api-key: %s"\nheader = "anthropic-version: 2023-06-01"\nheader = "content-type: application/json"\ndata = "@%s"\n' \
        "$API" "$KEY" "$BODY" \
       | curl -sS --config - --max-time 30 -o "$OUT" -w '%{http_code}' || true)
# curl yang gagal menyambung tetap mencetak sesuatu lewat -w; yang kosong berarti
# curl sendiri tidak jalan.
[ -n "$CODE" ] || CODE=000

REASON=""
if command -v python3 >/dev/null 2>&1 && [ -s "$OUT" ]; then
  REASON=$(python3 - "$OUT" <<'PY' 2>/dev/null || true
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
e = d.get("error") or {}
print(f"{e.get('type','')} — {e.get('message','')}".strip(" —"))
PY
)
fi

case "$CODE" in
  200)
    ok "API menerima kunci ini"
    ;;
  429)
    warn "kunci diterima tapi akun sedang kena limit / kehabisan kredit."
    warn "saya tetap tulis: yang gagal bukan kuncinya."
    ;;
  401|403)
    # Panjang yang benar dengan isi yang salah adalah kegagalan paling
    # membingungkan di sini: 108 karakter, awalan benar, ekor benar, tetap
    # ditolak. Itu selalu berarti ada karakter yang salah di TENGAH — yang
    # terjadi kalau kunci disalin dengan mata, bukan dengan tombol Copy.
    HINT="Ambil dengan tombol Copy key di console.anthropic.com, jangan disalin dengan mata.
  Dialog kunci hanya tampil sekali; kalau sudah tertutup, buat kunci baru — 20 detik."
    if [ -n "$SAME" ]; then
      HINT="Yang Anda tempel SAMA PERSIS dengan yang sudah terpasang dan sudah ditolak.
  Mengulanginya akan selalu memberi jawaban yang sama. $HINT"
    elif [ -n "$CURRENT" ] && [ "${KEY: -4}" = "${CURRENT: -4}" ]; then
      HINT="Ekor 4 karakternya sama dengan yang terpasang, jadi ini memang kunci yang benar
  dengan satu-dua karakter salah di tengah — O dan 0, l dan I, biasanya. $HINT"
    fi
    die "API menolak kunci ini (HTTP $CODE). ${REASON:-tanpa alasan}
  yang diuji: $(mask "$KEY")  (${#KEY} karakter)
  .env TIDAK diubah — yang lama masih di tempatnya.
  $HINT"
    ;;
  000)
    die "tidak bisa menghubungi $API. Jaringan server, bukan kuncinya. .env tidak diubah."
    ;;
  *)
    die "API menjawab HTTP $CODE. ${REASON:-tanpa alasan}. .env tidak diubah."
    ;;
esac

say "Menulis .env"
# Ditulis lewat berkas sementara di folder yang sama lalu dipindah: kalau server
# mati di tengah, .env tetap utuh — bukan setengah baris tanpa kunci apa pun.
umask 077
TMP=$(mktemp "$(dirname "$ENV_FILE")/.env.baru.XXXXXX")
if [ -f "$ENV_FILE" ]; then
  grep -v "^${NAME}=" "$ENV_FILE" > "$TMP" || true
  # Baris terakhir tanpa newline akan menempel pada kunci baru.
  [ -s "$TMP" ] && [ "$(tail -c1 "$TMP" | wc -l)" -eq 0 ] && printf '\n' >> "$TMP"
fi
printf '%s=%s\n' "$NAME" "$KEY" >> "$TMP"
chmod 600 "$TMP"
mv "$TMP" "$ENV_FILE"
ok "$NAME tersimpan di $ENV_FILE (chmod 600), variabel lain tidak tersentuh"

if [ "${SKIP_RELOAD:-}" = "1" ]; then
  warn "reload dilewati (SKIP_RELOAD=1)"
  exit 0
fi

say "Menerapkan ke proses yang berjalan"
if [ -f "$APP/scripts/reload-env-igitur.sh" ]; then
  bash "$APP/scripts/reload-env-igitur.sh"
else
  warn "reload-env-igitur.sh tidak ada — jalankan deploy.sh untuk menerapkannya."
  exit 0
fi

say "Membuktikan lewat situs"
# Kunci di .env tidak berarti apa-apa sampai proses yang melayani pembaca
# memakainya. Inilah yang ditanya pembaca, ditanyakan dari luar.
PROBE=$(curl -s --max-time 60 "https://$DOMAIN/api/ask" || true)
if command -v python3 >/dev/null 2>&1 && [ -n "$PROBE" ]; then
  printf '%s' "$PROBE" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("  jawaban probe tidak terbaca"); raise SystemExit
for s in d.get("steps", []):
    mark = "  ok " if s.get("ok") else "GAGAL"
    print(f"    [{mark}] {s.get(\"step\"):<16} {s.get(\"status\") or \"\"} {s.get(\"message\") or \"\"}".rstrip())
print(f"    {d.get(\"verdict\",\"\")}")
' || printf '%s\n' "$PROBE"
else
  printf '%s\n' "$PROBE"
fi
echo
echo "  Coba sendiri: https://$DOMAIN/ask"
