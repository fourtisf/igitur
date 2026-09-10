#!/usr/bin/env bash
#
# Satu perintah untuk menerbitkan versi terbaru.
#
#   bash /var/www/igitur/scripts/deploy.sh
#
# Ini TIDAK menggantikan update-igitur.sh — ia memanggilnya. Yang ditambahkan
# hanya dua hal yang selama ini harus diingat manusia, dan sekali terlupa
# membuat server menyajikan kode berumur berminggu-minggu tanpa satu pun galat:
#
#   1. Memastikan checkout benar-benar mengikuti cabang produksi. Server ini
#      pernah mengikuti cabang sesi, `claude/new-session-ao22yh`, dan setiap
#      update melapor "sudah terbaru" DENGAN BENAR — cabang itu memang tidak
#      bergerak. Jawabannya tepat, pertanyaannya yang salah.
#
#   2. Mengisi catatan, sekali saja. Deploy baru punya /ledger kosong, dan
#      halaman yang seluruh situs ada untuk mengisinya membaca "Nothing on the
#      record yet." Pengunjung tidak bisa membedakan itu dari situs yang mati.
#
# Aman dijalankan berulang kali: langkah 1 idempoten, langkah 2 hanya jalan
# kalau catatannya benar-benar kosong, dan langkah 3 punya rollback sendiri.
#
set -euo pipefail

APP="${APP:-/var/www/igitur}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-igitur.xyz}"
LEDGER="${LEDGER_PATH:-$APP/data/ledger.jsonl}"

say()  { printf '\n\033[1;36m=== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mBERHENTI: %s\033[0m\n' "$*" >&2; exit 1; }

[ -d "$APP/.git" ] || die "$APP bukan repo git. Untuk pemasangan pertama pakai deploy-igitur.sh."

# ── 1. Cabang ───────────────────────────────────────────────────────────────
say "1/3  Memastikan checkout mengikuti '$BRANCH'"
BEFORE=$(git -C "$APP" rev-parse --short HEAD)
CURRENT=$(git -C "$APP" symbolic-ref --quiet --short HEAD || echo "(HEAD terlepas)")

# set-branches lebih dulu: `git clone --depth 1` membuat klon SATU CABANG yang
# refspec-nya hanya memetakan cabang itu, jadi tanpa ini `git fetch origin main`
# hanya menulis FETCH_HEAD dan `origin/main` tidak pernah ada.
git -C "$APP" remote set-branches origin "$BRANCH"
git -C "$APP" fetch origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" --quiet \
  || die "Tidak bisa mengambil '$BRANCH'. Lihat: git -C $APP remote -v"

if [ "$CURRENT" != "$BRANCH" ]; then
  warn "checkout mengikuti '$CURRENT' — dipindahkan ke '$BRANCH'"
fi
git -C "$APP" checkout -B "$BRANCH" "origin/$BRANCH" --quiet
git -C "$APP" reset --hard "origin/$BRANCH" --quiet

AFTER=$(git -C "$APP" rev-parse --short HEAD)
WANT=$(git -C "$APP" rev-parse --short "origin/$BRANCH")
[ "$AFTER" = "$WANT" ] || die "reset tidak mendarat: HEAD $AFTER, origin/$BRANCH $WANT"
if [ "$BEFORE" = "$AFTER" ]; then
  ok "sudah di $AFTER"
else
  ok "$BEFORE → $AFTER"
  git -C "$APP" log --oneline "$BEFORE..$AFTER" 2>/dev/null | sed 's/^/      /' || true
fi

# ── 2. Terbitkan ────────────────────────────────────────────────────────────
# FORCE, karena cap build bisa cocok dengan commit lama yang salah setelah
# perbaikan cabang di atas — dan diam-diam melewati build adalah kegagalan yang
# baru saja diperbaiki, bukan yang mau diulang.
say "2/3  Membangun dan menerbitkan"
FORCE=1 bash "$APP/scripts/update-igitur.sh"

# ── 3. Catatan ──────────────────────────────────────────────────────────────
say "3/3  Catatan publik"
if [ -s "$LEDGER" ]; then
  ok "$(grep -c . "$LEDGER") klaim sudah tercatat — seed dilewati"
else
  warn "catatan kosong — mengisi dengan 26 tesis Igitur sendiri, sekali ini"
  # Lewat commit() yang sama dengan endpoint: tervalidasi, ditanggali server,
  # dan tidak bisa dibuat duplikat. Ditandai `house` supaya tidak ada yang
  # membacanya sebagai keyakinan orang lain.
  ( cd "$APP" && LEDGER_PATH="$LEDGER" npx tsx scripts/seed-ledger.ts )
fi

# ── Bukti, bukan anggapan ───────────────────────────────────────────────────
say "Selesai"
echo "  commit  : $(git -C "$APP" log --oneline -1)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$DOMAIN/" || echo "000")
if [ "$CODE" = "200" ]; then
  ok "https://$DOMAIN menjawab 200"
else
  warn "https://$DOMAIN menjawab $CODE — lihat: pm2 logs igitur --lines 60"
fi
echo "  periksa : https://$DOMAIN/status  ·  https://$DOMAIN/ledger"
