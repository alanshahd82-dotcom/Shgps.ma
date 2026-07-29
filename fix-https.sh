#!/bin/bash
# ===================================================
# سكربت إصلاح HTTPS تلقائياً - يحل مشكلة Chicken-and-Egg
# الاستخدام: cd /opt/shgps && bash fix-https.sh
# ===================================================
set -e

DOMAIN="athargps.com"
EMAIL="admin@shgps.ma"
PROJECT_DIR="/opt/shgps"

cd "$PROJECT_DIR"

echo ""
echo "========================================"
echo "  🔧 إصلاح HTTPS لـ $DOMAIN"
echo "========================================"
echo ""

# ─── الخطوة 1: مزامنة الريبو مع تجاهل التعديلات المحلية ──────
echo "📥 الخطوة 1: مزامنة الريبو..."
git fetch origin
git checkout -- nginx/nginx.conf 2>/dev/null || true
git reset --hard origin/main
echo "✅ تمت المزامنة."
echo ""

# ─── الخطوة 2: إيقاف Nginx وإعادة تشغيله بـ nginx.conf المؤقت ─
echo "🔄 الخطوة 2: إعادة تشغيل Nginx بالإعداد المؤقت (HTTP فقط)..."
docker compose stop nginx 2>/dev/null || true
sleep 2
docker compose up -d nginx
echo "⏳ انتظار 8 ثوانٍ..."
sleep 8

echo "📊 حالة Nginx:"
docker compose ps nginx

if docker compose ps nginx | grep -q "Restarting\|Exit"; then
    echo "❌ Nginx لا يزال متوقفاً! سجل الأخطاء:"
    docker compose logs --tail=20 nginx
    exit 1
fi
echo "✅ Nginx يعمل على HTTP."
echo ""

# ─── الخطوة 3: الحصول على شهادة SSL ──────────────────────────
echo "📜 الخطوة 3: طلب شهادة SSL من Let's Encrypt..."
docker compose run --rm --entrypoint "" certbot certbot certonly \
    --webroot -w /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" && CERT_OK=true || CERT_OK=false

if [ "$CERT_OK" = "false" ]; then
    echo ""
    echo "⚠️  webroot فشل، جرب standalone (يوقف Nginx مؤقتاً)..."
    docker compose stop nginx
    docker compose run --rm --entrypoint "" certbot certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
    docker compose start nginx
fi
echo ""

# ─── الخطوة 4: التحقق من الشهادات داخل Docker volume ─────────
echo "🔍 الخطوة 4: التحقق من الشهادات داخل Docker volume..."
if docker compose run --rm --entrypoint "" certbot \
    ls /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem > /dev/null 2>&1; then
    echo "✅ الشهادات موجودة داخل Docker volume:"
    docker compose run --rm --entrypoint "" certbot \
        ls -l /etc/letsencrypt/live/"$DOMAIN"/
else
    echo "❌ لم يتم إنشاء الشهادات! تفاصيل الخطأ:"
    docker compose run --rm --entrypoint "" certbot \
        certbot certificates 2>&1 || true
    exit 1
fi
echo ""

# ─── الخطوة 5: تطبيق nginx.conf الاحترافي (HTTPS) ─────────────
echo "🔐 الخطوة 5: تطبيق إعداد HTTPS الاحترافي..."
git checkout origin/ssl-ready -- nginx/nginx.conf
echo "✅ تم تطبيق nginx.conf مع HTTPS."
echo ""

# ─── الخطوة 6: إعادة تشغيل Nginx بإعدادات HTTPS ───────────────
echo "🔄 الخطوة 6: إعادة تشغيل Nginx بإعدادات HTTPS..."
docker compose restart nginx
echo "⏳ انتظار 8 ثوانٍ..."
sleep 8

echo "📊 حالة Nginx:"
docker compose ps nginx

if docker compose ps nginx | grep -q "Restarting\|Exit"; then
    echo "❌ Nginx فشل بعد تطبيق HTTPS! سجل الأخطاء:"
    docker compose logs --tail=20 nginx
    exit 1
fi
echo ""

# ─── الخطوة 7: التحقق النهائي ─────────────────────────────────
echo "🔍 الخطوة 7: التحقق النهائي..."
curl -sI --max-time 10 "https://$DOMAIN" | head -5 || \
    echo "⚠️  curl من داخل السيرفر قد لا يعمل - تحقق من المتصفح."

echo ""
echo "========================================"
echo "  ✅ تم الإنجاز بنجاح!"
echo "  🌐 افتح: https://$DOMAIN"
echo "========================================"
echo ""
