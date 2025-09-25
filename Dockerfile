# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY prisma ./prisma
COPY tsconfig*.json ./
COPY src ./src
COPY README.md ./
COPY .env.example ./

RUN npm run db:generate
RUN npm run build
RUN npm prune --omit=dev

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
