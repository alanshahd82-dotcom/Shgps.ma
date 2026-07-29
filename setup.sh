#!/bin/bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${GREEN}=== SHGPS Setup ===${NC}"

# 1. Swap
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo -e "${GREEN}✓ Swap${NC}"

# 2. Docker + Node.js + Git
if ! command -v docker &>/dev/null; then
    apt-get update -qq && curl -fsSL https://get.docker.com | sh
fi
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
command -v git &>/dev/null || apt-get install -y git
echo -e "${GREEN}✓ Docker + Node.js + Git${NC}"

# 3. Clone/Pull
if [ -d /opt/shgps ]; then
    cd /opt/shgps && git pull
else
    git clone https://github.com/alanshahd82-dotcom/Shgps.ma.git /opt/shgps
fi
cd /opt/shgps
echo -e "${GREEN}✓ Code downloaded${NC}"

# 4. Build React app on server
echo -e "${YELLOW}Building React app...${NC}"
npm install --production=false --legacy-peer-deps
npm run build
echo -e "${GREEN}✓ React app built${NC}"

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
TRACCAR_ADMIN_EMAIL=admin@shgps.ma
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
echo -e "${GREEN}✓ SHGPS is running!${NC}"
echo -e "URL:   ${BLUE}http://${SERVER_IP}${NC}"
echo -e "Login: ${YELLOW}admin@shgps.ma / Admin@1234${NC}"
echo -e "${RED}Change the password after first login!${NC}"
