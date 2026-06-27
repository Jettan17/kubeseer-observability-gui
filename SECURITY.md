# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in KubeObserve, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email: security@kubeobserve.dev

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 7 days
- **Fix:** Dependent on severity (critical: 72 hours, high: 2 weeks)

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | ✅ |
| Previous minor | ✅ (security fixes only) |
| Older | ❌ |

## Security Design Principles

1. **Localhost by default** — no network exposure without explicit opt-in
2. **No credentials on disk** — session data is memory-only
3. **TLS required for remote** — cannot bind to non-localhost without TLS
4. **RBAC passthrough** — users only see what their K8s credentials allow
5. **No eval/exec** — no dynamic code execution in the frontend
6. **Dependency minimization** — only well-known, actively maintained crates
