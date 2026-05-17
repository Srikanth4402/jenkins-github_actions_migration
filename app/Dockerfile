# ── STAGE 1: Install dependencies ──────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── STAGE 2: Run the app ────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/index.js"]
