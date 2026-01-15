# Multi-stage build for SSH/Mosh Telegram Mini App

# =============================================================================
# Stage 1: Builder - Build frontend and backend
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install dependencies
RUN npm install --prefix frontend
RUN npm install --prefix backend

# Copy source code
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend (Vite)
RUN cd frontend && npm run build

# Build backend (TypeScript)
RUN cd backend && npm run build

# =============================================================================
# Stage 2: Production - Minimal runtime image
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies: mosh-client and openssh-client
RUN apk add --no-cache \
    mosh-client \
    openssh-client \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy built frontend to public directory
COPY --from=builder /app/frontend/dist ./public

# Copy built backend
COPY --from=builder /app/backend/dist ./dist

# Copy node_modules from builder (includes native modules like better-sqlite3, node-pty)
COPY --from=builder /app/backend/node_modules ./node_modules

# Copy package.json for reference
COPY backend/package.json ./

# Create data directory for SQLite persistence
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

# Set ownership of app directory
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
