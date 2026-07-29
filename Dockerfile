# Stage 1: Build React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
RUN npm install --save-dev vite@^5.4.8 @vitejs/plugin-react@^4.3.2 tailwindcss@^3.4.13 autoprefixer@^10.4.20 postcss@^8.4.47
COPY . .
RUN ./node_modules/.bin/vite build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
