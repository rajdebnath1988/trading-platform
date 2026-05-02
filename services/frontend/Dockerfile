# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm ci --no-audit
COPY . .
RUN npm run build

# nginx:1.27-alpine has fewer CVEs than 1.25 and gets faster security patches
FROM nginx:1.27-alpine AS final
# Upgrade all apk packages to pick up latest Alpine security fixes
RUN apk upgrade --no-cache && rm -rf /var/cache/apk/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
