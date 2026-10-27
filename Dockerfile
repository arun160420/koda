# ==============================================================================
# KODA Studio — Production Container Image
# Multi-stage build for optimal image size and security
# ==============================================================================

FROM node:20-alpine AS base
WORKDIR /app

# Install build dependencies required for native packages (e.g. openssl for Prisma)
RUN apk add --no-cache openssl ca-certificates dumb-init

# Copy package manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including Prisma CLI for client generation)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and static assets
COPY . .

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose HTTP port
EXPOSE 3000

# Run as non-root user
USER node

# Use dumb-init to properly handle PID 1 signal termination (SIGTERM, SIGINT)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
