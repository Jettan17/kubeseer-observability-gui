# Phase 13: UX Polish & Differentiating Features

## Overview

Post-MVP polish to elevate from "functional demo" to "awards-worthy product." Prioritized by impact-to-effort ratio, informed by competitive analysis of Lens, Headlamp, Coroot, K8Studio, and Komodor.

## Priority 1: Instant Perceived Quality

### 13.1 Command Palette (⌘K / Ctrl+K)
- Fuzzy search across: resources, views, actions, settings
- Recent items section at top
- Keyboard-navigable with arrows, Enter to select
- Categories: "Resource", "Navigate", "Action"
- _Why:_ Every modern dev tool has this. Instant "this feels like a real product" signal.

### 13.2 Pod Detail Drawer
- Slide-out panel from right when clicking a pod (in topology or search)
- Shows: status, events timeline, labels/annotations, container list, restart history
- Resource usage gauges (CPU/mem from metrics)
- Action buttons: "View Logs", "View Traces", "Copy YAML"
- _Why:_ Shows depth. Demonstrates interconnection between views.

### 13.3 Theme Toggle (Dark/Light)
- Animated sun/moon icon button in header
- Smooth transition between themes (CSS transition on root vars)
- Respects system preference on first load
- _Why:_ Visible polish. Shows attention to detail.

### 13.4 Toast Notifications
- Bottom-right toast stack for real-time events
- Severity-colored left border (red=critical, yellow=warning)
- Auto-dismiss after 5s, click to navigate to resource
- Events: pod crash, node pressure, deployment rollout
- _Why:_ Makes the app feel alive. Shows real-time nature.

### 13.5 Namespace Swimlanes in Topology
- Group pods/deployments/services into namespace-colored regions
- Semi-transparent background rectangles with namespace labels
- Draggable to rearrange layout
- Collapse/expand individual namespaces
- _Why:_ Topology goes from "random dots" to "comprehensible organizational map"

## Priority 2: Technical Differentiation

### 13.6 Golden Signals Dashboard
- Add dedicated "Signals" section to metrics view showing all 4 golden signals:
  - **Latency**: p50/p95/p99 request duration per service (aggregated from trace spans)
  - **Traffic**: requests/sec per service (counted from trace span frequency)
  - **Errors**: error rate = error spans / total spans per service (with trending)
  - **Saturation**: existing CPU/memory vs limits (already implemented)
- Visual layout: 4 cards in a row, each with sparkline + current value + trend arrow
- Color thresholds: green < p50, yellow > p75, red > p95 of historical range
- _Why:_ This is the standard SRE monitoring framework. Shows we understand observability theory, not just "put charts on screen."

### 13.7 Log-to-Trace Correlation
- Detect trace IDs in log messages (regex: common formats like `trace_id=xxx`, `X-Trace-Id`, OpenTelemetry format)
- Render as clickable links in log viewer
- Click → jumps to Trace view, selects that trace, shows waterfall
- Reverse: trace span detail shows "Related Logs" section
- _Why:_ Nobody does this seamlessly. Connecting the observability pillars is the dream.

### 13.8 Deployment Timeline
- Horizontal timeline bar below topology (or as overlay)
- Shows deployment events (rollout start, completion, rollback)
- Correlated with metrics: "CPU spiked 2min after this deploy"
- Click a deployment event to see the diff (old vs new replica count, image tag)
- _Why:_ "What changed?" is the #1 debugging question. This answers it visually.

### 13.8 Deployment Timeline
- Horizontal timeline bar below topology (or as overlay)
- Shows deployment events (rollout start, completion, rollback)
- Correlated with metrics: "CPU spiked 2min after this deploy"
- Click a deployment event to see the diff (old vs new replica count, image tag)
- _Why:_ "What changed?" is the #1 debugging question. This answers it visually.

### 13.9 Keyboard Shortcuts & Help Overlay
- `1-4` switch views, `/` focus search, `⌘K` command palette
- `Esc` close panels/modals
- `?` shows overlay listing all shortcuts
- `j/k` navigate log lines, `n/p` next/prev search match
- _Why:_ Power users expect this. Shows the tool is built for speed.

## Priority 3: Future Differentiators (stretch)

### 13.9 Service Dependency Map
- Infer service-to-service communication from trace data
- Render as directed graph with traffic flow arrows
- Edge thickness = request volume, color = error rate
- Animated particles along edges showing live traffic
- _Why:_ This is what Coroot/Pixie/Kiali do. It's the "wow" feature.

### 13.10 AI Troubleshooting Assistant
- Chat panel (slide-out from right)
- "Why is payment-service crashing?" → correlates: crash events, error logs, metrics spikes, recent deploys
- Uses structured data from all stores to formulate answers
- Could integrate with LLM backend or rule-based engine
- _Why:_ Hot category. Even a basic version stands out. Komodor/Headlamp are going here.

## Task Dependencies

```
13.1 (Command Palette)  ─── independent
13.2 (Pod Detail)       ─── depends on topology click events (done)
13.3 (Theme Toggle)     ─── independent (theme system exists)
13.4 (Toast Notifs)     ─── independent
13.5 (Swimlanes)        ─── depends on topology layout engine
13.6 (Log→Trace)        ─── depends on log viewer + trace explorer (done)
13.7 (Deploy Timeline)  ─── depends on metrics time axis
13.8 (Keyboard)         ─── independent
13.9 (Service Map)      ─── depends on trace data processing
13.10 (AI Assistant)    ─── depends on all data stores
```

## Recommended Build Order

1. **13.3** Theme Toggle (30min) — quick visible win
2. **13.1** Command Palette (2-3hr) — biggest single UX improvement
3. **13.4** Toast Notifications (1-2hr) — makes it feel alive
4. **13.8** Keyboard Shortcuts (1hr) — fast, shows polish
5. **13.2** Pod Detail Drawer (2-3hr) — depth showcase
6. **13.5** Namespace Swimlanes (3-4hr) — topology becomes useful
7. **13.6** Log-to-Trace Correlation (2hr) — technical differentiator
8. **13.7** Deployment Timeline (3-4hr) — debugging UX
9. **13.9** Service Dependency Map (4-6hr) — wow factor
10. **13.10** AI Assistant (8hr+) — stretch goal


---

## Pre-Phase 13: Backend Wiring TODOs

These are leftover integration tasks from the core build that must be completed before/alongside Phase 13 features:

### Backend → Frontend Wiring
- [ ] Wire `ClusterManager` to REST `/api/v1/contexts` endpoint (return real kubeconfig contexts)
- [ ] Wire `ClusterManager.connect()` to `/api/v1/contexts/{name}/connect` endpoint
- [ ] Wire `ResourceWatcher` to WebSocket — broadcast `GraphPatch` events to subscribed clients
- [ ] Wire `ResourceWatcher.snapshot()` to `/api/v1/clusters/{id}/resources` endpoint
- [ ] Wire pod log streaming (kube-rs log API) to WebSocket `log_batch` messages
- [ ] Wire metrics polling (K8s Metrics API) to `/api/v1/clusters/{id}/metrics/...` endpoint
- [ ] Implement actual Prometheus query client for historical metrics
- [ ] Wire trace backend client (Jaeger/OTel) to `/api/v1/clusters/{id}/traces` endpoint

### Security Wiring
- [ ] Implement actual TLS listener bind in `main.rs` when `--tls` is set
- [ ] Implement OIDC authentication flow (redirect → token exchange → validate → session)
- [ ] Wire `auth_middleware` into router for non-localhost mode
- [ ] Add session cleanup background task (periodic `cleanup_expired()`)

### Frontend → Backend Wiring
- [ ] Replace mock data in `App.tsx` with actual WebSocket subscription
- [ ] `useWebSocket` hook subscribes to "topology" channel → applies patches to cluster store
- [ ] `useWebSocket` hook subscribes to "logs" channel → appends to log store
- [ ] REST calls for metrics when time window changes (instead of mock generator)
- [ ] REST calls for traces when service/duration filter changes

### Operational
- [ ] Remove `frontend/dist/` from git (it's in `.gitignore` but was committed for rust-embed during dev)
- [ ] Add `build.rs` to compile frontend automatically before Rust build
- [ ] Wire Cargo `[build]` script or Makefile for single `make release` command
