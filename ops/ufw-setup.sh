#!/bin/bash
# ops/ufw-setup.sh — إعداد جدار الحماية UFW للسيرفر
# شغّله مرة واحدة كـ root على السيرفر: sudo bash ops/ufw-setup.sh
# لا تشغّله داخل Docker.

set -e

echo "=== [UFW] تفعيل جدار الحماية ==="

# إعادة الضبط إلى الوضع الافتراضي
ufw --force reset

# السياسة الافتراضية: رفض كل شيء واردٍ، قبول كل شيء صادر
ufw default deny incoming
ufw default allow outgoing

# ── المنافذ المسموح بها ──────────────────────────────────────────
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP (redirect to HTTPS)'
ufw allow 443/tcp   comment 'HTTPS'
ufw allow 5023/tcp  comment 'GPS GT06/WanWay protocol'
ufw allow 5027/tcp  comment 'GPS Teltonika'
ufw allow 5029/tcp  comment 'GPS WanWay alternative'
ufw allow 5055/tcp  comment 'Traccar Client app'

# ── تفعيل UFW ───────────────────────────────────────────────────
ufw --force enable
ufw status verbose

echo "=== [UFW] تم الإعداد بنجاح ==="
