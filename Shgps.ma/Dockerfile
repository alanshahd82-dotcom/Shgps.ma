# Stage 1: Build React app
FROM node:20 AS builder
WORKDIR /app
COPY . .
RUN npm install --production=false --legacy-peer-deps
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
