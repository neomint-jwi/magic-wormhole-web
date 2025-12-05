# Frontend build stage
FROM oven/bun:1 AS frontend-builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies (use --frozen-lockfile if bun.lockb exists)
RUN if [ -f bun.lockb ]; then bun install --frozen-lockfile; else bun install; fi

# Copy source files
COPY tsconfig.json eslint.config.js ./
COPY src/ ./src/

# Build TypeScript (typecheck + lint + bundle)
RUN bun run build

# Backend build stage
FROM golang:1.21-alpine AS backend-builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy go mod file
COPY go.mod ./

# Copy source code
COPY main.go ./
COPY static/*.css static/*.html ./static/

# Copy built JavaScript from frontend stage
COPY --from=frontend-builder /app/static/*.js ./static/

# Download dependencies and build
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o wormhole-web .

# Final stage - minimal alpine for /tmp support
FROM alpine:3.19

# Add CA certificates
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN adduser -D -u 1000 wormhole

# Copy the binary
COPY --from=backend-builder /app/wormhole-web /wormhole-web

# Use non-root user
USER wormhole

# Expose port
EXPOSE 8080

# Run the binary
ENTRYPOINT ["/wormhole-web"]
