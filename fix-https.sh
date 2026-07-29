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

# ─── الخطوة 1: سحب آخر التغييرات من GitHub ───────────────────
echo "📥 الخطوة 1: سحب آخر التغييرات من GitHub..."
git pull origin main
echo "✅ تم."
echo ""

# ─── الخطوة 2: كسر حلقة التعطل (تفعيل Nginx بـ HTTP فقط) ────
echo "🔧 الخطوة 2: تفعيل nginx.conf المؤقت (HTTP فقط)..."
cp nginx/nginx.conf nginx/nginx.conf.https_backup
cp nginx/nginx.conf.bootstrap nginx/nginx.conf
echo "✅ تم استبدال nginx.conf بالنسخة المؤقتة."
echo ""

# ─── الخطوة 3: تشغيل Nginx ────────────────────────────────────
echo "🚀 الخطوة 3: تشغيل Nginx..."
docker compose up -d nginx
echo "⏳ انتظار 5 ثوانٍ..."
sleep 5

echo "📊 حالة Nginx:"
docker compose ps nginx

if ! docker compose ps nginx | grep -q "Up"; then
    echo "❌ Nginx لا يزال متوقفاً!"
    echo "سجل الأخطاء:"
    docker compose logs --tail=20 nginx
    exit 1
fi
echo "✅ Nginx يعمل."
echo ""

# ─── الخطوة 4: الحصول على شهادة SSL ──────────────────────────
echo "📜 الخطوة 4: طلب شهادة SSL من Let's Encrypt..."
docker compose run --rm --entrypoint "" certbot certbot certonly \
    --webroot -w /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ فشل في الحصول على الشهادة عبر --webroot."
    echo "🔄 المحاولة بوضع --standalone (سيوقف Nginx مؤقتاً)..."
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

# ─── الخطوة 5: التحقق من الشهادات ────────────────────────────
echo "🔍 الخطوة 5: التحقق من الشهادات..."
if ls /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem &>/dev/null; then
    echo "✅ الشهادات موجودة:"
    ls -l /etc/letsencrypt/live/"$DOMAIN"/
else
    echo "❌ لم يتم إنشاء الشهادات! تحقق من إعدادات DNS."
    exit 1
fi
echo ""

# ─── الخطوة 6: استعادة إعدادات HTTPS الكاملة ─────────────────
echo "🔐 الخطوة 6: استعادة nginx.conf الاحترافي (HTTPS)..."
cp nginx/nginx.conf.https_backup nginx/nginx.conf
echo "✅ تم استعادة الإعدادات الاحترافية."
echo ""

# ─── الخطوة 7: إعادة تشغيل Nginx بإعدادات HTTPS ───────────────
echo "🔄 الخطوة 7: إعادة تشغيل Nginx بإعدادات HTTPS..."
docker compose restart nginx
echo "⏳ انتظار 5 ثوانٍ..."
sleep 5

echo "📊 حالة Nginx:"
docker compose ps nginx
echo ""

# ─── الخطوة 8: التحقق النهائي ─────────────────────────────────
echo "🔍 الخطوة 8: التحقق النهائي..."
if curl -sI --max-time 10 "https://$DOMAIN" | head -1 | grep -q "HTTP"; then
    echo "✅ الموقع يعمل عبر HTTPS!"
    curl -sI --max-time 10 "https://$DOMAIN" | head -5
else
    echo "⚠️  curl من داخل السيرفر قد لا يعمل - تحقق من المتصفح."
fi

echo ""
echo "========================================"
echo "  ✅ تم الإنجاز بنجاح!"
echo "  🌐 افتح: https://$DOMAIN"
echo "========================================"
echo ""
