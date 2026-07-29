# Stage 1: Build React app
FROM node:20 AS builder
WORKDIR /app
RUN npm install -g vite@5
COPY . .
RUN npm install --legacy-peer-deps
RUN vite build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
