#!/usr/bin/env bash
#
# Membersihkan proyek lama dari VPS ini, sebelum Igitur dipasang.
#
# Menghapus: aplikasi pm2, direktori proyek di /var/www, blok nginx.
# TIDAK menghapus: sertifikat SSL, /var/www/html, situs nginx "default".
#
# Semuanya diarsipkan lebih dulu. Arsip boleh dihapus setelah Anda yakin.
#
#   bash wipe-server.sh
#
set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="/root/backup-sebelum-igitur-$STAMP.tar.gz"
META="/root/wipe-meta-$STAMP"

say()  { printf '\n\033[1;36m=== %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mBERHENTI: %s\033[0m\n' "$*" >&2; exit 1; }

# Direktori yang tidak pernah disentuh.
skip_dir() {
  case "$1" in
    html|igitur) return 0 ;;
    *) return 1 ;;
  esac
}

# ── 1. Inventaris: tunjukkan persis apa yang akan hilang ─────────────────────
say "1/6  Yang akan dihapus"

echo "-- Aplikasi pm2 --"
pm2 list 2>/dev/null || echo "  (tidak ada)"

echo
echo "-- Direktori di /var/www --"
for d in /var/www/*/; do
  n=$(basename "$d")
  skip_dir "$n" && { echo "  $n  (DIPERTAHANKAN)"; continue; }
  printf "  %-14s %8s  diubah %s\n" "$n" \
    "$(du -sh "$d" 2>/dev/null | cut -f1)" \
    "$(date -r "$d" '+%Y-%m-%d %H:%M')"
done

echo
echo "-- Blok nginx aktif --"
ls /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/  /' || echo "  (tidak ada)"

echo
echo "-- Apakah kodenya ada salinan di GitHub? --"
UNPUSHED=0
for d in /var/www/*/; do
  n=$(basename "$d")
  skip_dir "$n" && continue
  if [ -d "$d/.git" ]; then
    remote=$(git -C "$d" remote get-url origin 2>/dev/null || echo "")
    dirty=$(git -C "$d" status --porcelain 2>/dev/null | wc -l)
    if [ -z "$remote" ]; then
      warn "  $n  -> repo git TANPA remote. Kode hanya ada di server ini."
      UNPUSHED=1
    elif [ "$dirty" -gt 0 ]; then
      warn "  $n  -> $remote, tapi $dirty berkas belum di-commit."
      UNPUSHED=1
    else
      echo "  $n  -> $remote  (bersih, ada salinannya)"
    fi
  else
    warn "  $n  -> BUKAN repo git. Kode hanya ada di server ini."
    UNPUSHED=1
  fi
done

if [ "$UNPUSHED" -eq 1 ]; then
  warn "
  Sebagian kode tidak punya salinan di luar server ini. Setelah langkah 5,
  arsip di langkah 2 adalah satu-satunya salinan yang tersisa."
fi

# ── 2. Arsip ─────────────────────────────────────────────────────────────────
say "2/6  Mengarsipkan"
mkdir -p "$META"
pm2 jlist > "$META/pm2.json" 2>/dev/null || true
cp -r /etc/nginx/sites-available "$META/nginx-sites-available" 2>/dev/null || true
ls -1 /etc/letsencrypt/live/ > "$META/daftar-sertifikat.txt" 2>/dev/null || true

tar --exclude='node_modules' --exclude='.next' --exclude='dist' --exclude='.cache' \
    -czf "$BACKUP" -C / var/www "root/$(basename "$META")"
rm -rf "$META"

echo "  arsip : $BACKUP  ($(du -sh "$BACKUP" | cut -f1))"
echo "  isi   : /var/www + konfigurasi nginx + daftar pm2 + daftar sertifikat"
echo "  tidak disertakan: node_modules, .next, dist (bisa dibangun ulang)"
[ -s "$BACKUP" ] || die "Arsip kosong. Tidak melanjutkan."

# ── 3. Konfirmasi ────────────────────────────────────────────────────────────
say "3/6  Konfirmasi"
echo "Aplikasi pm2 akan berhenti dan domain-domain di atas berhenti melayani."
echo
read -r -p 'Ketik persis  HAPUS SEMUA  lalu Enter: ' JAWAB
[ "$JAWAB" = "HAPUS SEMUA" ] || die "Dibatalkan. Tidak ada yang dihapus.
       Arsip tetap ada di $BACKUP (boleh Anda hapus)."

# ── 4. Hentikan aplikasi ─────────────────────────────────────────────────────
say "4/6  Menghentikan aplikasi"
APPS=$(pm2 jlist 2>/dev/null | tr ',' '\n' | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | grep -v '^igitur$' || true)
if [ -z "$APPS" ]; then
  echo "  (tidak ada aplikasi pm2)"
else
  for app in $APPS; do
    echo "  menghapus $app"
    pm2 delete "$app" >/dev/null 2>&1 || true
  done
fi
pm2 save >/dev/null 2>&1 || true

# ── 5. Hapus berkas dan blok nginx ───────────────────────────────────────────
say "5/6  Menghapus berkas"
for d in /var/www/*/; do
  n=$(basename "$d")
  skip_dir "$n" && continue
  echo "  menghapus $d"
  rm -rf -- "$d"
done

for s in /etc/nginx/sites-enabled/*; do
  [ -e "$s" ] || continue
  n=$(basename "$s")
  case "$n" in
    igitur.xyz|default) echo "  $n  (DIPERTAHANKAN)"; continue ;;
  esac
  echo "  menonaktifkan $n"
  rm -f -- "$s"
done

# Satu konfigurasi rusak menjatuhkan seluruh nginx, termasuk Igitur nanti.
nginx -t || die "Konfigurasi nginx tidak valid. TIDAK di-reload, jadi nginx
       masih berjalan dengan konfigurasi lama. Kembalikan tautan yang perlu:
         ln -s /etc/nginx/sites-available/<nama> /etc/nginx/sites-enabled/"
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
  echo "  nginx di-reload"
else
  echo "  nginx memang tidak berjalan — dibiarkan, deploy-igitur.sh yang menyalakannya"
fi

# ── 6. Selesai ───────────────────────────────────────────────────────────────
say "6/6  Selesai"
echo "  arsip      : $BACKUP"
echo "  disk bebas : $(df -h / | tail -1 | awk '{print $4}')"
echo
pm2 list 2>/dev/null || true
echo
warn "Sertifikat SSL sengaja TIDAK dihapus."
echo "  Menghapusnya tidak membebaskan ruang berarti, dan kalau salah satu domain
  dipakai lagi nanti, sertifikatnya sudah siap. Kalau tetap ingin bersih:
     certbot certificates
     certbot delete --cert-name <nama>"
echo
echo "Berikutnya:  bash deploy-igitur.sh"
