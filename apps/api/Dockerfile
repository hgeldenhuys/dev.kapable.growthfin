# Agios API - Production Dockerfile
# Multi-stage build optimized for Bun runtime

# Stage 1: Dependencies
FROM oven/bun:1 AS deps
WORKDIR /app

# Copy root package files
COPY package.json bun.lock ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including dev dependencies for build)
RUN bun install

# Stage 2: Build
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY packages/db ./packages/db
COPY apps/api ./apps/api
COPY package.json bun.lockb tsconfig.json ./

# Build the database package
WORKDIR /app/packages/db
RUN bun run build

# Build the API
WORKDIR /app/apps/api
RUN bun run build

# Stage 3: Production Runtime
FROM oven/bun:1-slim AS runtime
WORKDIR /app

# Install production dependencies only
COPY package.json bun.lock ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

RUN bun install --production

# Copy built artifacts from builder
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy migration files (needed for db:push at runtime)
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle
COPY --from=builder /app/packages/db/drizzle.config.ts ./packages/db/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3000/health').then(r => r.ok || process.exit(1))"

# Start API server
WORKDIR /app/apps/api
CMD ["bun", "run", "start"]
