#!/bin/bash
# سكربت تفعيل HTTPS - يُنفذ بعد شراء النطاق وتوجيهه للسيرفر
# الاستخدام: ./enable-https.sh yourdomain.com

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "❌ الاستخدام: ./enable-https.sh yourdomain.com"
    exit 1
fi

echo "🚀 بدء تفعيل HTTPS للنطاق: $DOMAIN"

# 1. الحصول على شهادة SSL
echo "📜 طلب شهادة SSL من Let's Encrypt..."
docker compose run --rm certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --email admin@shgps.ma \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d $DOMAIN

if [ $? -ne 0 ]; then
    echo "❌ فشل في الحصول على شهادة SSL. تأكد أن النطاق يشير إلى IP: 64.226.103.251"
    exit 1
fi

echo "✅ تم الحصول على شهادة SSL بنجاح!"

# 2. تحديث nginx.conf - استبدال server_name
sed -i "s/server_name _;\(.*\)$/server_name $DOMAIN;/" /opt/shgps/nginx/nginx.conf
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /opt/shgps/nginx/nginx.conf

# 3. تفعيل قسم HTTPS في nginx.conf (إلغاء التعليق)
sed -i 's/#   server {/  server {/' /opt/shgps/nginx/nginx.conf
sed -i 's/#       listen 443/      listen 443/' /opt/shgps/nginx/nginx.conf
sed -i 's/#       server_name/      server_name/' /opt/shgps/nginx/nginx.conf
sed -i 's/#       ssl_certificate /      ssl_certificate /' /opt/shgps/nginx/nginx.conf
sed -i 's/#       ssl_certificate_key/      ssl_certificate_key/' /opt/shgps/nginx/nginx.conf
sed -i 's/#       ssl_protocols/      ssl_protocols/' /opt/shgps/nginx/nginx.conf
sed -i 's/#       ssl_ciphers/      ssl_ciphers/' /opt/shgps/nginx/nginx.conf
sed -i 's/#       ssl_prefer_server_ciphers/      ssl_prefer_server_ciphers/' /opt/shgps/nginx/nginx.conf
sed -i 's/#       location \//      location \//' /opt/shgps/nginx/nginx.conf
sed -i 's/#           root /          root /' /opt/shgps/nginx/nginx.conf
sed -i 's/#           index /          index /' /opt/shgps/nginx/nginx.conf
sed -i 's/#           try_files/          try_files/' /opt/shgps/nginx/nginx.conf
sed -i 's/#       }/      }/' /opt/shgps/nginx/nginx.conf
sed -i 's/#   }/  }/' /opt/shgps/nginx/nginx.conf

# 4. تفعيل إعادة التوجيه من HTTP إلى HTTPS في server block الـ 80
sed -i 's|# return 301 https://\$host\$request_uri;|return 301 https://$host$request_uri;|' /opt/shgps/nginx/nginx.conf
# تعطيل خدمة الملفات الثابتة عبر HTTP (بعد تفعيل HTTPS)
sed -i '/return 301 https/{ n; /root.*html/d }' /opt/shgps/nginx/nginx.conf

# 5. تحديث FRONTEND_URL في docker-compose.yml
sed -i "s|FRONTEND_URL:.*http://.*|FRONTEND_URL:             https://$DOMAIN|" /opt/shgps/docker-compose.yml

# 6. إعادة تشغيل الخدمات
echo "🔄 إعادة تشغيل Nginx..."
docker compose restart nginx

echo ""
echo "✅ تم تفعيل HTTPS بنجاح!"
echo "🌐 افتح: https://$DOMAIN"
echo ""
echo "ℹ️  لتجديد الشهادة يدوياً: docker compose run --rm certbot certbot renew"
