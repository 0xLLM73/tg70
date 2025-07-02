# Multi-stage Dockerfile for Cabal.Ventures Telegram Bot
# Stage 1: Build stage
FROM node:22-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/bot/package.json ./packages/bot/
COPY packages/functions/package.json ./packages/functions/
COPY packages/infra/package.json ./packages/infra/
COPY packages/sql/package.json ./packages/sql/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the project
RUN pnpm build

# Stage 2: Production stage
FROM node:22-alpine AS production

# Install pnpm globally
RUN npm install -g pnpm

# Create non-root user
RUN addgroup -g 1001 -S cabal && \
    adduser -S cabal -u 1001 -G cabal

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY packages/bot/package.json ./packages/bot/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder --chown=cabal:cabal /app/packages/bot/dist ./packages/bot/dist

# Switch to non-root user
USER cabal

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["node", "packages/bot/dist/index.js"]