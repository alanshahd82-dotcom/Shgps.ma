#!/bin/bash
# ops/restore.sh — استعادة أحدث نسخة احتياطية من قاعدة البيانات
# شغّله على السيرفر: sudo bash ops/restore.sh
# تحذير: سيحذف البيانات الحالية ويستبدلها بالنسخة الاحتياطية.

set -e

CONTAINER="shgps-postgres-1"
BACKUP_VOL="shgps_backups_data"

echo "=== [Restore] البحث عن أحدث نسخة احتياطية ==="

# أحدث ملف في volume الاحتياطيات
LATEST=$(docker run --rm -v "${BACKUP_VOL}:/backups" alpine \
  sh -c "ls -t /backups/*.sql.gz 2>/dev/null | head -1")

if [ -z "$LATEST" ]; then
  echo "❌ لم يُعثر على نسخة احتياطية في /backups"
  exit 1
fi

echo "✅ النسخة المُختارة: $LATEST"
echo "⚠️  سيُستعاد قاعدة shgps من هذه النسخة. اضغط Ctrl+C للإلغاء أو انتظر 5 ثوانٍ..."
sleep 5

# استعادة
docker run --rm \
  --network shgps_shgps \
  -v "${BACKUP_VOL}:/backups" \
  -e PGPASSWORD="${DB_PASSWORD:-$(grep DB_PASSWORD /opt/shgps/.env | cut -d= -f2)}" \
  postgres:16-alpine \
  sh -c "gunzip -c $LATEST | psql -h shgps-postgres-1 -U shgps -d shgps"

echo "=== [Restore] اكتملت الاستعادة بنجاح ==="
