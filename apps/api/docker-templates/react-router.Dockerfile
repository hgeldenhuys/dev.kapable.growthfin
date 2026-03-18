# SignalDB Apps Platform - React Router 7 + Bun Template
# This Dockerfile is used to build and run user-deployed React Router 7 apps
#
# Build args:
#   - APP_NAME: Name of the app (for labeling)
#   - GIT_COMMIT: Git commit SHA being deployed
#
# Environment variables at runtime:
#   - PORT: Port to listen on (injected by SignalDB)
#   - DATABASE_URL: SignalDB project database connection
#   - SIGNALDB_API_URL: SignalDB API endpoint
#   - SIGNALDB_API_KEY: API key for the linked project
#   - NODE_ENV: production

FROM oven/bun:1.1-alpine AS base

# Install git for potential build-time operations
RUN apk add --no-cache git

WORKDIR /app

# ============ Dependencies Stage ============
FROM base AS deps

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# ============ Build Stage ============
FROM base AS builder

ARG APP_NAME="signaldb-app"
ARG GIT_COMMIT="unknown"

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set build-time environment
ENV NODE_ENV=production

# Build the app (React Router 7)
RUN bun run build

# ============ Production Stage ============
FROM oven/bun:1.1-alpine AS runner

ARG APP_NAME="signaldb-app"
ARG GIT_COMMIT="unknown"

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built assets from builder
COPY --from=builder --chown=appuser:nodejs /app/build ./build
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# Install only production dependencies
COPY --from=builder /app/node_modules ./node_modules

# Set labels
LABEL org.opencontainers.image.title="${APP_NAME}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.vendor="SignalDB" \
      signaldb.app.name="${APP_NAME}" \
      signaldb.app.commit="${GIT_COMMIT}"

# Switch to non-root user
USER appuser

# Expose port (will be overridden by SignalDB)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Environment
ENV NODE_ENV=production \
    PORT=3000

# Start the app using react-router-serve
CMD ["bun", "run", "react-router-serve", "./build/server/index.js"]
