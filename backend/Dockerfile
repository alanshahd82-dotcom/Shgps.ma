FROM node:20-alpine
    WORKDIR /app
    COPY package.json ./
    RUN npm install --omit=dev --no-audit --no-fund && ls node_modules/express/ > /dev/null
    COPY src ./src
    EXPOSE 3001
    HEALTHCHECK --interval=30s --timeout=10s CMD wget -qO- http://localhost:3001/api/health || exit 1
    CMD ["node", "src/index.js"]