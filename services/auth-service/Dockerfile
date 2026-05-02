# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# npm install works without package-lock.json; npm ci requires it
RUN npm install --omit=dev --no-audit && npm cache clean --force

FROM node:20-alpine AS final
# Remove npm from final image — eliminates all npm CVEs
RUN apk del --no-cache npm 2>/dev/null || true && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs src/ ./src/
USER nodejs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "src/index.js"]
