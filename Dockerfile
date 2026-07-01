# Multi-stage build for kubeseer
# Produces a minimal container for shared deployment mode

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY frontend/ .
RUN pnpm run build

# Stage 2: Build Rust binary
FROM rust:1.78-slim AS backend-builder
WORKDIR /app
RUN apt-get update && apt-get install -y cmake pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY src/ src/
COPY benches/ benches/
COPY --from=frontend-builder /app/frontend/dist frontend/dist/
RUN cargo build --release

# Stage 3: Minimal runtime image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=backend-builder /app/target/release/kubeseer /usr/local/bin/kubeseer

# Non-root user
RUN useradd -r -s /bin/false kubeseer
USER kubeseer

EXPOSE 8080

ENTRYPOINT ["kubeseer"]
CMD ["--host", "0.0.0.0", "--port", "8080", "--tls", "--no-open"]
