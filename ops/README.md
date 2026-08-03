# ops/ — دليل العمليات اليدوية

هذا المجلد يحتوي على السكريبتات التي تُنفَّذ **مرة واحدة** على السيرفر (ليس داخل Docker).

---

## 1. إعداد جدار الحماية (UFW)

```bash
sudo bash ops/ufw-setup.sh
```

المنافذ المفتوحة:
| المنفذ | الاستخدام |
|--------|-----------|
| 22 | SSH |
| 80 | HTTP → إعادة توجيه لـ HTTPS |
| 443 | HTTPS |
| 5023 | GT06 / WanWay GPS |
| 5027 | Teltonika GPS |
| 5029 | WanWay بروتوكول بديل |
| 5055 | تطبيق Traccar Client |

---

## 2. استعادة النسخة الاحتياطية

```bash
# تأكد من وجود DB_PASSWORD في البيئة أو في /opt/shgps/.env
export DB_PASSWORD=your_db_password
sudo bash ops/restore.sh
```

⚠️ **تحذير**: يحذف البيانات الحالية ويستبدلها.

---

## 3. تشغيل المشروع أول مرة

```bash
cd /opt/shgps
cp .env.example .env          # اضبط القيم
docker compose up -d --build
# انتظر حتى يستقر traccar (90 ثانية تقريباً)
docker compose logs -f backend
```

---

## 4. تحديث الـ Frontend بعد build جديد

```bash
cd /opt/shgps
git pull
npm run build                 # أو: pnpm build
docker compose restart nginx
```

---

## 5. النسخ الاحتياطية التلقائية

الـ `db-backup` service يعمل تلقائياً كل 24 ساعة ويحفظ الملفات في volume `backups_data`.  
يُبقي على آخر 7 نسخ فقط.

لعرض النسخ الموجودة:
```bash
docker run --rm -v shgps_backups_data:/backups alpine ls -lh /backups
```

---

## 6. تجديد شهادة SSL يدوياً

```bash
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d athargps.com -d www.athargps.com \
  --email admin@athargps.ma --agree-tos
docker compose restart nginx
```

---

## 7. مراقبة الـ containers

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f traccar
```

---

## 8. الفحص الشامل للنظام

هذا الفحص لا يغيّر البيانات ولا يعيد تشغيل الحاويات. يعرض حالة Docker وPostgreSQL وTraccar وBackend وNginx وHTTPS والمنافذ والنسخ الاحتياطية والواجهة العامة، ثم يعرض أسطر السجل المشبوهة من آخر 30 دقيقة.

```bash
cd /opt/shgps
bash ops/diagnose.sh
```

لفحص رابط مختلف:

```bash
BASE_URL=https://athargps.com bash ops/diagnose.sh
```

معاني النتيجة:

- `OK`: الاختبار ناجح.
- `WARN`: الخدمة تعمل غالباً، لكن هناك ملاحظة تحتاج مراجعة.
- `FAIL`: يوجد عطل يحتاج إصلاحاً.
- ينتهي الأمر برمز `0` عند النجاح، `2` عند وجود تحذيرات فقط، و`1` عند وجود فشل.

لجمع السجل في ملف:

```bash
bash ops/diagnose.sh 2>&1 | tee /tmp/athargps-diagnose.txt
```
