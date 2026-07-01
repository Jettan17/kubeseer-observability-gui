# Contributing to KubeSeer

Thank you for considering contributing to KubeSeer! This document outlines the process for contributing.

## Development Setup

### Prerequisites

- Rust 1.75+ (`rustup install stable`)
- Node.js 18+ with pnpm (`npm install -g pnpm`)
- A Kubernetes cluster (minikube, kind, or k3s for local dev)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/KubeSeer/KubeSeer.git
cd KubeSeer

# Install frontend dependencies
cd frontend && pnpm install && cd ..

# Run tests
cargo test

# Build frontend
cd frontend && pnpm run build && cd ..

# Run the application
cargo run
```

### Development Workflow

1. **Backend:** `cargo run` starts the server. Use `cargo watch -x run` for auto-reload.
2. **Frontend:** `cd frontend && pnpm run dev` starts Vite dev server with API proxy to the backend.
3. **Tests:** `cargo test` for backend, `cd frontend && pnpm test` for frontend.

## Code Standards

### Rust

- Use `rustfmt` for formatting (default config)
- Use `clippy` for linting: `cargo clippy -- -W clippy::all`
- All public APIs must have doc comments
- Prefer `thiserror` for error types, `anyhow` for application errors
- All async code uses `tokio`

### TypeScript

- Strict TypeScript (`strict: true`)
- Functional components with hooks
- Zustand for state management
- ARIA attributes for accessibility

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add pod log export to JSON
fix: resolve WebSocket reconnection race condition
docs: update README with new CLI flags
test: add stress tests for resource graph
```

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass: `cargo test` and `pnpm test`
4. Update documentation if needed
5. Submit PR with a clear description of changes

## Architecture Decisions

Key decisions are documented in `.kiro/specs/kube-observe-gui/design.md`. When proposing significant changes, update the design doc or open a discussion first.

## Security

Report security vulnerabilities privately — see [SECURITY.md](SECURITY.md).
