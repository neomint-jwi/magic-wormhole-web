# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy go mod file
COPY go.mod ./

# Copy source code
COPY . .

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
COPY --from=builder /app/wormhole-web /wormhole-web

# Use non-root user
USER wormhole

# Expose port
EXPOSE 8080

# Run the binary
ENTRYPOINT ["/wormhole-web"]
