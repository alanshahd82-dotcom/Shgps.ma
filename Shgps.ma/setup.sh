#!/bin/bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${GREEN}=== ATHAR GPS Setup ===${NC}"

# 1. Swap
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo -e "${GREEN}✓ Swap${NC}"

# 2. Docker + Git
apt-get update -qq
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
fi
command -v git &>/dev/null || apt-get install -y -qq git
echo -e "${GREEN}✓ Docker + Git${NC}"

# 3. Firewall (UFW)
apt-get install -y -qq ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 5027/tcp  # GPS GT06 (GS900)
ufw allow 5023/tcp  # GPS Wanway
ufw --force enable
echo -e "${GREEN}✓ Firewall (UFW) configured${NC}"

# 4. Clone/Pull
if [ -d /opt/shgps ]; then
    cd /opt/shgps && git pull
else
    git clone https://github.com/alanshahd82-dotcom/Shgps.ma.git /opt/shgps
fi
cd /opt/shgps
echo -e "${GREEN}✓ Using pre-built app${NC}"

# 5. .env
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
if [ ! -f /opt/shgps/.env ]; then
    DB_PASS=$(openssl rand -hex 12)
    JWT_SECRET=$(openssl rand -hex 32)
    TRACCAR_PASS=$(openssl rand -hex 8)
    cat > /opt/shgps/.env << ENVEOF
DOMAIN=${SERVER_IP}
DB_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
TRACCAR_ADMIN_EMAIL=admin@athargps.ma
TRACCAR_ADMIN_PASSWORD=${TRACCAR_PASS}
ENVEOF
    echo -e "${BLUE}DB Password:      ${RED}${DB_PASS}${NC}"
    echo -e "${BLUE}Traccar Password: ${RED}${TRACCAR_PASS}${NC}"
fi
echo -e "${GREEN}✓ Config ready${NC}"

# 6. Run
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ ATHAR GPS is running!             ${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "  🌐 URL:    ${BLUE}http://${SERVER_IP}${NC}"
echo -e "  👤 Login:  ${YELLOW}admin@athargps.ma${NC}"
echo -e "  🔑 Pass:   ${YELLOW}Admin@1234${NC}"
echo -e "  📡 GPS Port: ${YELLOW}5027 (GT06/GS900)${NC}"
echo ""
echo -e "${RED}  ⚠️  Change the admin password after first login!${NC}"
echo ""
echo -e "Firewall status:"
ufw status
