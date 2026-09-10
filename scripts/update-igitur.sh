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

# `set -e` menghentikan skrip tanpa sepatah kata pun. Pada skrip deploy itu
# kegagalan terburuk: operator melihat sebuah judul, lalu prompt, dan tidak tahu
# apakah situsnya sudah tersentuh. Apa pun yang keluar tidak nol tanpa pesan
# kami sendiri, disebutkan di sini.
FAILED_CMD=""; FAILED_LINE=""; DIED=""
trap 'FAILED_CMD=$BASH_COMMAND; FAILED_LINE=$LINENO' ERR
trap 'rc=$?; if [ "$rc" -ne 0 ] && [ -z "$DIED" ]; then
        printf "\n\033[1;31mBERHENTI mendadak di baris %s (kode %s):\n  %s\n  Situs TIDAK diubah oleh kegagalan ini.\033[0m\n" \
          "${FAILED_LINE:-?}" "$rc" "${FAILED_CMD:-?}" >&2
      fi' EXIT

say()  { printf '\n\033[1;36m=== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die()  { DIED=1; printf '\n\033[1;31mBERHENTI: %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. Ini memang pemasangan yang sudah jalan? ──────────────────────────────
say "1/7  Memeriksa pemasangan yang ada"
[ -d "$APP/.git" ] || die "$APP bukan repo git. Untuk pemasangan pertama pakai deploy-igitur.sh."
pm2 describe "$PM2_NAME" >/dev/null 2>&1 || die "pm2 tidak mengenal '$PM2_NAME'. Untuk pemasangan pertama pakai deploy-igitur.sh."

# Port diambil dari nginx, bukan ditebak. Inilah satu-satunya sumber kebenaran:
# ke sinilah lalu lintas sungguhan dikirim.
# -R, bukan -r: sites-enabled berisi symlink ke sites-available, dan `grep -r`
# melewatkan symlink yang ditemuinya saat menelusuri. Dengan -r skrip ini tidak
# menemukan apa pun di server sungguhan meski konfigurasinya ada.
# `|| true` supaya kegagalan grep memunculkan pesan di bawah, bukan `set -e`
# yang mematikan skrip tanpa penjelasan.
CONF=$(grep -Rl "server_name .*$DOMAIN" "$NGINX_DIR/" 2>/dev/null | head -1 || true)
[ -n "$CONF" ] || CONF=$(grep -Rl "server_name .*$DOMAIN" /etc/nginx/sites-available/ 2>/dev/null | head -1 || true)
if [ -z "$CONF" ]; then
  die "Tidak menemukan blok nginx untuk $DOMAIN di $NGINX_DIR atau sites-available.
       Lihat sendiri:  grep -Rl \"$DOMAIN\" /etc/nginx/"
fi
PORT=$(grep -oE 'proxy_pass +https?://127\.0\.0\.1:[0-9]+' "$CONF" 2>/dev/null | grep -oE '[0-9]+$' | head -1 || true)
if [ -z "$PORT" ]; then
  die "Tidak bisa membaca port dari $CONF. Periksa manual sebelum lanjut:
       grep proxy_pass $CONF"
fi
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

# Pertanyaannya bukan "apakah git berubah barusan", melainkan "apakah yang
# TERPASANG cocok dengan yang TERBANGUN". Versi pertama skrip ini membandingkan
# HEAD sebelum dan sesudah fetch — dan siapa pun yang menjalankan
# `git reset --hard origin/HEAD` lebih dulu membuat keduanya sama, sehingga
# skrip menyatakan "sudah terbaru" sementara .next masih build lama. Kode baru
# di disk, kode lama yang disajikan. Jadi commit yang dibangun dicap ke dalam
# build itu sendiri, dan itulah yang dibandingkan.
BUILT_STAMP="$APP/.next/BUILT_COMMIT"
BUILT=$(cat "$BUILT_STAMP" 2>/dev/null || true)

# Skrip ini ada DI DALAM repo yang sebentar lagi ia perbarui, dan bash membaca
# berkas skrip sambil menjalankannya. Kalau isinya berubah di tengah jalan,
# sisa perintah dibaca dari offset yang sudah tidak cocok. Itu bukan teori:
# pada satu update, langkah verifikasi dan laporan akhir yang dijalankan masih
# milik versi lama, sehingga deploy terlihat sukses tanpa pernah menyentuh
# pemeriksaan yang baru saja ditambahkan. Jadi sidik jarinya dicatat dulu.
SELF="$APP/scripts/update-igitur.sh"
SELF_SUM=$(cksum "$SELF" 2>/dev/null | awk '{print $1"-"$2}' || true)

# Cabang produksi. Disebut namanya, bukan disimpulkan.
#
# Dua cara skrip ini pernah membangun kode yang salah tanpa satu pun galat:
#
#   `git reset --hard origin/HEAD`  — `git fetch` tidak pernah memperbarui
#   refs/remotes/origin/HEAD, jadi resetnya bisa jadi tidak memindahkan apa pun.
#
#   Menyimpulkan cabang dari checkout — server ini ternyata mengikuti cabang
#   sesi, `claude/new-session-ao22yh`, berminggu-minggu. Setiap update melapor
#   "sudah terbaru" dengan BENAR: cabang itu memang tidak bergerak. Yang salah
#   bukan jawabannya, melainkan pertanyaannya. Produksi mengikuti satu cabang
#   yang ditentukan, dan kalau checkout ada di tempat lain itu harus dipindahkan
#   dan dikatakan, bukan diikuti.
#
# Bisa ditimpa untuk staging:  BRANCH=coba bash scripts/update-igitur.sh
BRANCH="${BRANCH:-main}"

# `git clone --depth 1` membuat klon SATU CABANG: refspec-nya hanya memetakan
# cabang yang dikloning, sehingga `git fetch origin main` hanya menulis
# FETCH_HEAD dan `origin/main` tidak pernah ada — "fatal: ambiguous argument
# 'origin/main'". Dua baris ini yang membuat cabang produksi benar-benar bisa
# dilacak, apa pun bentuk klon aslinya.
git -C "$APP" remote set-branches origin "$BRANCH"
git -C "$APP" fetch origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" --quiet \
  || die "Tidak bisa mengambil cabang '$BRANCH' dari origin.
       Lihat sendiri:  git -C $APP remote -v  dan  git -C $APP ls-remote --heads origin"

CURRENT=$(git -C "$APP" symbolic-ref --quiet --short HEAD || echo "(HEAD terlepas)")
if [ "$CURRENT" != "$BRANCH" ]; then
  warn "checkout mengikuti '$CURRENT', bukan '$BRANCH' — dipindahkan ke '$BRANCH'"
fi
git -C "$APP" checkout -B "$BRANCH" "origin/$BRANCH" --quiet
git -C "$APP" reset --hard "origin/$BRANCH" --quiet
NEW_COMMIT=$(git -C "$APP" rev-parse HEAD)

# Buktikan resetnya mendarat. Kegagalan diam di langkah ini adalah kegagalan
# terburuk skrip ini: semua langkah berikutnya membangun dan menguji kode lama,
# lulus, lalu melapor sukses.
WANT=$(git -C "$APP" rev-parse "origin/$BRANCH")
[ "$NEW_COMMIT" = "$WANT" ] || die "reset tidak mendarat: HEAD ${NEW_COMMIT:0:7}, origin/$BRANCH ${WANT:0:7}"
ok "mengikuti cabang $BRANCH"

# Kalau skrip ini sendiri ikut berubah, mulai lagi dari awal dengan isi yang
# baru — sekali saja, dijaga oleh REEXEC supaya tidak berputar.
if [ "${REEXEC:-}" != "1" ] && [ -n "$SELF_SUM" ] && [ -f "$SELF" ] \
   && [ "$SELF_SUM" != "$(cksum "$SELF" | awk '{print $1"-"$2}')" ]; then
  ok "skrip deploy ini ikut diperbarui — dijalankan ulang dengan versi barunya"
  REEXEC=1 exec bash "$SELF"
fi

# Dipakai kalau harus mundur: kode yang cocok dengan .next yang tersimpan.
ROLLBACK_COMMIT="${BUILT:-$NEW_COMMIT}"

if [ -z "$BUILT" ]; then
  warn "build yang ada tidak bercap — dibangun ulang supaya cap bisa dipercaya nanti"
elif [ "$BUILT" = "$NEW_COMMIT" ] && [ "${FORCE:-}" != "1" ]; then
  ok "sudah terbaru: build cocok dengan ${NEW_COMMIT:0:7}"
  echo "  (untuk membangun ulang paksa: FORCE=1 bash scripts/update-igitur.sh)"
  exit 0
else
  ok "terpasang ${NEW_COMMIT:0:7}, terbangun ${BUILT:0:7} — perlu dibangun"
  git -C "$APP" log --oneline "$BUILT..$NEW_COMMIT" 2>/dev/null | sed 's/^/      /' || true
fi

cd "$APP"

# ── 3. Kunci dan handle ─────────────────────────────────────────────────────
say "3/7  Membaca konfigurasi"
# MARKET_* dibaca saat RUNTIME — cukup restart.
# NEXT_PUBLIC_* dibaca saat BUILD — harus ikut ke perintah build di bawah.
MARKET_ENV=""
BUILD_ENV=""
if [ -f "$APP/.env" ]; then
  MARKET_ENV=$(grep -E '^(MARKET_(PROVIDER|API_KEY|TTL_S)|TWELVEDATA_API_KEY)=' "$APP/.env" 2>/dev/null | tr '\n' ' ' || true)
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
  git reset --hard "$ROLLBACK_COMMIT" --quiet
  # shellcheck disable=SC2086
  env NEXT_PUBLIC_SITE_URL="https://$DOMAIN" PORT="$PORT" HOSTNAME="127.0.0.1" \
  LEDGER_PATH="$APP/data/ledger.jsonl" MARKET_CACHE_PATH="$APP/data/quotes.json" $MARKET_ENV \
    pm2 restart "$PM2_NAME" --update-env >/dev/null 2>&1 || true
  sleep 3
  if curl -fsS --max-time 10 "http://127.0.0.1:$PORT/" -o /dev/null 2>/dev/null; then
    warn "versi lama hidup kembali — situs aman, update dibatalkan"
  else
    printf '\n\033[1;31mSITUS MASIH MATI setelah dikembalikan. Lihat: pm2 logs %s --lines 60\033[0m\n' "$PM2_NAME" >&2
  fi
}

# shellcheck disable=SC2086
# MARKET_OFFLINE: a build prerenders 184 pages across three workers, and
# without this every deploy fired the whole universe at the vendor several
# times over in seconds — an instant 429 and most of a day's allowance spent
# before a single reader arrived. The build renders generated figures,
# flagged as generated, and the first revalidation fetches real ones.
if ! env NEXT_PUBLIC_SITE_URL="https://$DOMAIN" MARKET_OFFLINE=1 $BUILD_ENV npm run build; then
  restore
  die "Build gagal. Tidak ada yang berubah di situs."
fi

# .next/static tidak ikut ke dalam standalone. Tanpa ini situs terbuka tanpa CSS.
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public
echo "$NEW_COMMIT" > "$BUILT_STAMP"
ok "standalone siap: $(du -sh .next/standalone | cut -f1), dicap ${NEW_COMMIT:0:7}"

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
env NEXT_PUBLIC_SITE_URL="https://$DOMAIN" PORT="$PORT" HOSTNAME="127.0.0.1" \
  LEDGER_PATH="$APP/data/ledger.jsonl" MARKET_CACHE_PATH="$APP/data/quotes.json" $MARKET_ENV \
  pm2 restart "$PM2_NAME" --update-env
pm2 save >/dev/null
sleep 4

# ── 7. Membuktikan, bukan menganggap ────────────────────────────────────────
say "7/7  Memverifikasi"
FAIL=0
# Setiap rute yang dipakai orang, termasuk yang baru. Daftar ini pernah
# menyatakan sebuah deploy berhasil tanpa pernah menyentuh halaman yang justru
# baru saja di-deploy — tambahkan rute baru ke sini, bukan ke ingatan.
for path in / /status /universe /trending /token /legal /ledger /compose /changes /api/market-probe; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:$PORT$path" || true)
  if [ "$code" = "200" ]; then printf '  \033[1;32m✓\033[0m %-18s %s\n' "$path" "$code"
  else printf '  \033[1;31m✗\033[0m %-18s %s\n' "$path" "$code"; FAIL=1; fi
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
# Dulu jawabannya cuma "sumbernya tidak menjawab", dan mencari tahu kenapa
# butuh akses shell. Sekarang deploy-nya sendiri yang bertanya, dan setiap
# langkah melapor kode HTTP-nya.
echo "  Data pasar (langsung dari server ini):"
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
echo "  Halaman jujurnya: https://$DOMAIN/status"
