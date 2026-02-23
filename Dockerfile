# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- builder stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# 環境変数でVespaエンドポイントを設定できます:
#   VESPA_URL      - クエリコンテナURL (デフォルト: http://localhost:8081)
#   FEED_URL       - フィードコンテナURL (デフォルト: http://localhost:8080)
#   CONFIG_URL     - コンフィグサーバーURL (デフォルト: http://localhost:19071)
CMD ["node", "server.js"]
