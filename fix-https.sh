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

# ─── الخطوة 1: مزامنة الريبو ──────────────────────────────────
echo "📥 الخطوة 1: مزامنة الريبو..."
git fetch origin
git checkout -- nginx/nginx.conf 2>/dev/null || true
git reset --hard origin/main
echo "✅ تمت المزامنة."
echo ""

# ─── الخطوة 2: تشغيل Nginx بـ HTTP فقط ──────────────────────
echo "🔄 الخطوة 2: تشغيل Nginx بالإعداد المؤقت (HTTP فقط)..."
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

# ─── الخطوة 3: الحصول على شهادة SSL (بدون تفاعل) ────────────
echo "📜 الخطوة 3: طلب/تأكيد شهادة SSL من Let's Encrypt..."

# تحقق أولاً إذا الشهادة موجودة داخل الـ volume
CERT_EXISTS=$(docker compose run --rm --entrypoint "" certbot \
    sh -c "test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem && echo yes || echo no" 2>/dev/null)

if [ "$CERT_EXISTS" = "yes" ]; then
    echo "✅ الشهادة موجودة مسبقاً في Docker volume، تخطي طلب جديد."
else
    echo "🔄 طلب شهادة جديدة..."
    docker compose run --rm --entrypoint "" certbot certbot certonly \
        --webroot -w /var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --keep-until-expiring \
        --non-interactive \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" && CERT_OK=true || CERT_OK=false

    if [ "$CERT_OK" = "false" ]; then
        echo "⚠️  webroot فشل، جرب standalone..."
        docker compose stop nginx
        docker compose run --rm --entrypoint "" certbot certbot certonly \
            --standalone \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            --keep-until-expiring \
            --non-interactive \
            -d "$DOMAIN" \
            -d "www.$DOMAIN"
        docker compose start nginx
    fi
fi
echo ""

# ─── الخطوة 4: التحقق من الشهادات داخل Docker volume ─────────
echo "🔍 الخطوة 4: التحقق من الشهادات..."
docker compose run --rm --entrypoint "" certbot \
    ls -l /etc/letsencrypt/live/"$DOMAIN"/ 2>&1 || {
        echo "❌ الشهادات غير موجودة داخل Docker volume!"
        exit 1
    }
echo ""

# ─── الخطوة 5: التحقق أن Nginx يرى نفس الـ volume ───────────
echo "🔍 الخطوة 5: التحقق أن Nginx يرى الشهادات..."
docker exec shgps-nginx-1 ls -l /etc/letsencrypt/live/"$DOMAIN"/ 2>&1 && \
    echo "✅ Nginx يرى الشهادات بنجاح." || \
    echo "⚠️  Nginx لا يرى الشهادات بعد - قد تحتاج restart."
echo ""

# ─── الخطوة 6: تطبيق nginx.conf الاحترافي (HTTPS) ─────────────
echo "🔐 الخطوة 6: تطبيق إعداد HTTPS الاحترافي..."
git checkout origin/ssl-ready -- nginx/nginx.conf
echo "✅ تم تطبيق nginx.conf مع HTTPS."
echo ""

# ─── الخطوة 7: إعادة تشغيل Nginx بإعدادات HTTPS ───────────────
echo "🔄 الخطوة 7: إعادة تشغيل Nginx بإعدادات HTTPS..."
docker compose restart nginx
echo "⏳ انتظار 8 ثوانٍ..."
sleep 8

echo "📊 حالة Nginx:"
docker compose ps nginx

if docker compose ps nginx | grep -q "Restarting\|Exit"; then
    echo "❌ Nginx فشل! سجل الأخطاء:"
    docker compose logs --tail=20 nginx
    exit 1
fi
echo ""

# ─── الخطوة 8: التحقق النهائي ─────────────────────────────────
echo "🔍 الخطوة 8: التحقق النهائي..."
curl -sI --max-time 10 "https://$DOMAIN" | head -5 || \
    echo "⚠️  curl من داخل السيرفر قد لا يعمل - تحقق من المتصفح."

echo ""
echo "========================================"
echo "  ✅ تم الإنجاز بنجاح!"
echo "  🌐 افتح: https://$DOMAIN"
echo "========================================"
echo ""
