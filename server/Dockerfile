# Multi-stage build for production-ready image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Generate Prisma client (schema is at src/db/schema.prisma per package.json)
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install SSL libraries for Prisma
RUN apk add --no-cache openssl

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy Prisma schema and generate client
COPY src/db/schema.prisma ./src/db/schema.prisma
COPY src/db/migrations ./src/db/migrations
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 12321

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:12321/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["./docker-entrypoint.sh"]


