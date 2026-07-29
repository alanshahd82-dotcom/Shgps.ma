#!/bin/bash
# ===================================================
# سكربت إصلاح HTTPS تلقائياً
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

if docker compose ps nginx | grep -q "Restarting\|Exit"; then
    echo "❌ Nginx لا يزال متوقفاً! سجل الأخطاء:"
    docker compose logs --tail=20 nginx
    exit 1
fi
echo "✅ Nginx يعمل على HTTP."
echo ""

# ─── الخطوة 3: الحصول على الشهادة أو الاحتفاظ بالموجودة ──────
echo "📜 الخطوة 3: التحقق من الشهادة..."

# تحقق إذا الشهادة موجودة داخل الـ volume
CERT_EXISTS=$(docker compose run --rm --entrypoint "" certbot \
    sh -c "[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ] && echo yes || echo no" 2>/dev/null | tail -1)

if [ "$CERT_EXISTS" = "yes" ]; then
    echo "✅ الشهادة موجودة مسبقاً، تخطي طلب جديد."
else
    echo "🔄 طلب شهادة جديدة (بدون تفاعل)..."
    # -n = non-interactive تماماً, --keep-until-expiring = لا تجدد إذا الشهادة لم تنته
    docker compose run --rm --entrypoint "" certbot certbot certonly \
        -n \
        --keep-until-expiring \
        --webroot -w /var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" || {

        echo "⚠️  webroot فشل، جرب standalone..."
        docker compose stop nginx
        docker compose run --rm --entrypoint "" certbot certbot certonly \
            -n \
            --keep-until-expiring \
            --standalone \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN" \
            -d "www.$DOMAIN"
        docker compose start nginx
    }
fi
echo ""

# ─── الخطوة 4: تأكيد وجود الشهادة ────────────────────────────
echo "🔍 الخطوة 4: تأكيد الشهادة داخل Docker volume..."
docker compose run --rm --entrypoint "" certbot \
    ls -l /etc/letsencrypt/live/"$DOMAIN"/ 2>&1
echo ""

# ─── الخطوة 5: تطبيق nginx.conf مع HTTPS ──────────────────────
echo "🔐 الخطوة 5: تطبيق nginx.conf الاحترافي (HTTPS)..."
git checkout origin/ssl-ready -- nginx/nginx.conf
echo "✅ تم تطبيق nginx.conf."
echo ""

# ─── الخطوة 6: إعادة تشغيل Nginx بـ HTTPS ─────────────────────
echo "🔄 الخطوة 6: إعادة تشغيل Nginx بـ HTTPS..."
docker compose restart nginx
echo "⏳ انتظار 8 ثوانٍ..."
sleep 8

docker compose ps nginx

if docker compose ps nginx | grep -q "Restarting\|Exit"; then
    echo "❌ Nginx فشل! سجل الأخطاء:"
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
