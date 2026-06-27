# KubeObserve

A high-performance, secure Kubernetes observability GUI built with Rust and React.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

## What is KubeObserve?

KubeObserve is an open-source, full-stack Kubernetes observability tool that provides:

- **Visual cluster topology** — interactive graph of nodes, deployments, services, and pods
- **Real-time log streaming** — click any pod to stream its logs with search and filtering
- **Metrics dashboard** — CPU, memory, network charts with threshold alerts
- **Distributed trace explorer** — waterfall diagrams for request tracing across services
- **Multi-cluster support** — switch between up to 10 clusters seamlessly

All packaged in a single binary with zero external dependencies.

## Quick Start

```bash
# Download the latest release for your platform
# Or build from source:
cargo build --release

# Run (auto-opens browser)
./target/release/kubeobserve

# Or specify options
./target/release/kubeobserve --port 8080 --no-open
```

KubeObserve reads your `~/.kube/config` automatically. No additional configuration needed.

## Architecture

```
┌─────────────────────────────────────────────┐
│           Single Rust Binary                │
│                                             │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Axum Server │  │ Embedded React SPA  │  │
│  │ (API + WS)  │  │ (TypeScript/Canvas) │  │
│  └─────────────┘  └─────────────────────┘  │
│                                             │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │ kube-rs     │  │ Resource Graph      │  │
│  │ (K8s API)   │  │ (Watch + Broadcast) │  │
│  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Backend:** Rust with Tokio async runtime, Axum web framework, kube-rs for Kubernetes API  
**Frontend:** React 18 + TypeScript, Canvas/WebGL rendering, Zustand state management  
**Security:** Localhost-only by default, TLS required for external access, no credentials on disk

## Features

| Feature | Status |
|---------|--------|
| Cluster auto-discovery (kubeconfig) | ✅ |
| Visual topology with force-directed layout | ✅ |
| Real-time pod/deployment/service watching | ✅ |
| Log streaming with search & level filtering | ✅ |
| Metrics dashboard (Canvas charts) | ✅ |
| Distributed trace waterfall | ✅ |
| Multi-cluster switching | ✅ |
| Health indicators & notifications | ✅ |
| REST API for programmatic access | ✅ |
| Dark/light theme | ✅ |
| WebSocket real-time updates | ✅ |
| Single binary distribution | ✅ |
| Prometheus integration | 🔜 |
| OpenTelemetry/Jaeger integration | 🔜 |
| Plugin system | 🔜 |

## Security Model

- **Default (localhost):** Binds to 127.0.0.1 only. No auth needed — same trust model as kubectl.
- **Shared mode:** Requires `--tls` with certificate and key. Supports OIDC authentication.
- **Credentials:** Never written to disk. Held in memory only for session duration.
- **RBAC:** Users only see resources their Kubernetes credentials permit.

## Building from Source

### Prerequisites

- Rust 1.75+ (with cargo)
- Node.js 18+ (with pnpm)

### Build

```bash
# Install frontend dependencies
cd frontend && pnpm install && pnpm run build && cd ..

# Build the Rust binary (includes embedded frontend)
cargo build --release
```

### Development

```bash
# Terminal 1: Backend with hot reload
cargo watch -x run

# Terminal 2: Frontend dev server (proxies API to backend)
cd frontend && pnpm run dev
```

## Configuration

| Flag | Env Var | Default | Description |
|------|---------|---------|-------------|
| `--host` | `KUBEOBSERVE_HOST` | `127.0.0.1` | Bind address |
| `--port` | `KUBEOBSERVE_PORT` | `0` (random) | Bind port |
| `--kubeconfig` | `KUBECONFIG` | `~/.kube/config` | Kubeconfig path |
| `--tls` | `KUBEOBSERVE_TLS` | `false` | Enable TLS |
| `--tls-cert` | `KUBEOBSERVE_TLS_CERT` | - | TLS cert path |
| `--tls-key` | `KUBEOBSERVE_TLS_KEY` | - | TLS key path |
| `--session-timeout-hours` | `KUBEOBSERVE_SESSION_TIMEOUT` | `8` | Session TTL |
| `--no-open` | `KUBEOBSERVE_NO_OPEN` | `false` | Don't open browser |
| `--log-level` | `KUBEOBSERVE_LOG_LEVEL` | `info` | Log level |

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and PR process.
