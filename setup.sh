#!/bin/bash

# ============================================
# SHGPS - Auto Setup Script
# يشغّل كل شيء تلقائياً بأمر واحد
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ____  _   _  ____ ____  ____  "
echo " / ___|| | | |/ ___|  _ \/ ___| "
echo " \___ \| |_| | |  _| |_) \___ \ "
echo "  ___) |  _  | |_| |  __/ ___) |"
echo " |____/|_| |_|\____|_|   |____/ "
echo -e "${NC}"
echo -e "${GREEN}بدء الإعداد التلقائي...${NC}"
echo ""

# ============================================
# 1. إضافة Swap (مهم لـ 1GB RAM)
# ============================================
echo -e "${YELLOW}[1/6] إعداد الذاكرة الافتراضية (Swap)...${NC}"
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo -e "${GREEN}✓ تم إضافة 2GB Swap${NC}"
else
    echo -e "${GREEN}✓ Swap موجود مسبقاً${NC}"
fi

# ============================================
# 2. تثبيت Docker
# ============================================
echo -e "${YELLOW}[2/6] تثبيت Docker...${NC}"
if ! command -v docker &> /dev/null; then
    apt-get update -qq
    curl -fsSL https://get.docker.com | sh
    echo -e "${GREEN}✓ تم تثبيت Docker${NC}"
else
    echo -e "${GREEN}✓ Docker مثبت مسبقاً${NC}"
fi

# ============================================
# 3. تثبيت Git
# ============================================
echo -e "${YELLOW}[3/6] تثبيت Git...${NC}"
if ! command -v git &> /dev/null; then
    apt-get install -y -qq git
fi
echo -e "${GREEN}✓ Git جاهز${NC}"

# ============================================
# 4. تحميل المشروع
# ============================================
echo -e "${YELLOW}[4/6] تحميل المشروع من GitHub...${NC}"
if [ -d /opt/shgps ]; then
    echo "المجلد موجود، تحديث الكود..."
    cd /opt/shgps && git pull
else
    git clone https://github.com/alanshahd82-dotcom/Shgps.ma.git /opt/shgps
fi
cd /opt/shgps
echo -e "${GREEN}✓ تم تحميل المشروع${NC}"

# ============================================
# 5. إعداد ملف البيئة
# ============================================
echo -e "${YELLOW}[5/6] إعداد الإعدادات...${NC}"

# الحصول على IP الخارجي
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s api.ipify.org 2>/dev/null || echo "localhost")

if [ ! -f /opt/shgps/.env ]; then
    # توليد كلمات مرور عشوائية قوية
    DB_PASS=$(openssl rand -base64 20 | tr -d '=+/' | cut -c1-16)
    JWT_SECRET=$(openssl rand -base64 48 | tr -d '=+/')
    TRACCAR_PASS=$(openssl rand -base64 12 | tr -d '=+/' | cut -c1-12)

    cat > /opt/shgps/.env << EOF
# إعدادات SHGPS - تم توليدها تلقائياً
DOMAIN=${SERVER_IP}

# قاعدة البيانات
DB_PASSWORD=${DB_PASS}

# الأمان
JWT_SECRET=${JWT_SECRET}

# Traccar (خادم GPS)
TRACCAR_ADMIN_EMAIL=admin@shgps.ma
TRACCAR_ADMIN_PASSWORD=${TRACCAR_PASS}
EOF

    echo -e "${GREEN}✓ تم إنشاء ملف الإعدادات${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${YELLOW}احفظ هذه المعلومات بأمان:${NC}"
    echo -e "  كلمة مرور قاعدة البيانات: ${RED}${DB_PASS}${NC}"
    echo -e "  كلمة مرور Traccar:         ${RED}${TRACCAR_PASS}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo ""
else
    echo -e "${GREEN}✓ ملف الإعدادات موجود مسبقاً${NC}"
fi

# ============================================
# 6. تشغيل المشروع
# ============================================
echo -e "${YELLOW}[6/6] تشغيل المشروع (قد يستغرق 3-5 دقائق)...${NC}"
cd /opt/shgps
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}       ✓ تم تشغيل SHGPS بنجاح!            ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 الموقع:        ${BLUE}http://${SERVER_IP}${NC}"
echo -e "  👤 بريد المدير:   ${YELLOW}admin@shgps.ma${NC}"
echo -e "  🔑 كلمة المرور:   ${YELLOW}Admin@1234${NC}"
echo ""
echo -e "${RED}  ⚠️  غيّر كلمة مرور المدير فور الدخول!${NC}"
echo ""
echo -e "للتحقق من حالة الخدمات:"
echo -e "  ${BLUE}docker compose ps${NC}"
echo ""
