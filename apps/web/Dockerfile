# Agios Web - Production Dockerfile
# Multi-stage build for React Router 7 with SSR

# Stage 1: Dependencies
FROM oven/bun:1 AS deps
WORKDIR /app

# Install Python and build tools for native dependencies (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./
COPY packages/db/package.json ./packages/db/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN bun install

# Stage 2: Build
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/api-client/node_modules ./packages/api-client/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code
COPY packages/db ./packages/db
COPY packages/api-client ./packages/api-client
COPY apps/web ./apps/web
COPY package.json bun.lockb tsconfig.json ./

# Build database package
WORKDIR /app/packages/db
RUN bun run build

# Build API client package (if it has build script)
WORKDIR /app/packages/api-client
RUN if grep -q '"build"' package.json; then bun run build; fi

# Build web app
WORKDIR /app/apps/web
RUN bun run build

# Stage 3: Production Runtime
FROM oven/bun:1-slim AS runtime
WORKDIR /app

# Install Node.js (required for React Router serve)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package.json bun.lock ./
COPY packages/db/package.json ./packages/db/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/web/package.json ./apps/web/

RUN bun install --production

# Copy built artifacts
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/api-client/dist ./packages/api-client/dist
COPY --from=builder /app/packages/api-client/package.json ./packages/api-client/
COPY --from=builder /app/apps/web/build ./apps/web/build
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose web port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start React Router SSR server
WORKDIR /app/apps/web
CMD ["bun", "run", "start"]
