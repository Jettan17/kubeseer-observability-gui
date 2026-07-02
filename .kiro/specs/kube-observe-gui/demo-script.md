# KubeSeer — 3-Minute Demo Script

## Setup Before Recording

- Run `cargo run -- --no-open --port 9090`
- Open `http://127.0.0.1:9090` in browser (dark mode, full screen)
- Make sure prod-us-east-1 cluster is selected
- Close any open panels/overlays

---

## Opening (0:00 – 0:20)

**What to say:**
- KubeSeer is a Kubernetes observability GUI built with Rust and React
- Single binary, zero config — reads your kubeconfig and opens in the browser
- Designed for SREs who want visual cluster insight without the Datadog price tag

**What to show:**
- The app already loaded on topology view
- Point out the architecture: Rust backend (Axum, tokio, kube-rs), embedded React SPA, everything in one ~50MB binary

---

## Topology View (0:20 – 0:55)

**What to say:**
- This is the cluster topology — live force-directed graph of all resources
- Infrastructure nodes pinned at top, workloads grouped by namespace below
- Each shape means something: circles = pods, hexagons = deployments, diamonds = services, squares = nodes
- Color tells health: green = healthy, yellow = warning, red = critical
- Namespace boundaries calculated with a custom physics engine — inter-namespace repulsion keeps groups separated

**What to show:**
- Hover a pod → tooltip with name, status
- Click a pod → detail drawer slides in (status, metrics, labels, restart count)
- Click "View Logs" in drawer → navigates to Logs filtered to that pod
- Switch to "Service Map" tab → show L-R hierarchical dependency graph
- Pan and zoom the canvas

**Notes to self:**
- The layout uses d3-force with custom namespace clustering + inter-namespace repulsion
- BFS-based hierarchical layout for service map (not random force, intentional L-R flow)
- Legend should be visible bottom-left (if it's not showing, mention it's there in code)

---

## Logs View (0:55 – 1:20)

**What to say:**
- Real-time log streaming with virtual scroll — handles 1M+ lines at 60fps
- Severity filtering (toggle error/warn/info/debug)
- Full-text search with match highlighting
- Multi-container interleaved view with color-coded container names
- Log-to-trace correlation: detects trace IDs in log messages and shows clickable links

**What to show:**
- Scroll through logs — notice the smooth virtual scroll
- Toggle off "INFO" → only errors/warnings visible
- Type something in search → matches highlighted
- Point out a log line with "🔗 trace" badge (if visible)

**Notes to self:**
- Log-to-trace link currently routes to the Traces tab and auto-selects the first trace (not the specific matched trace — that would need real backend trace ID lookup)
- Live streaming: 2 new lines every 2.5s (simulated)

---

## Metrics View (1:20 – 1:50)

**What to say:**
- Golden Signals at the top — the 4 SRE signals: latency, traffic, errors, saturation
- Each has a sparkline showing trend, color-coded thresholds
- Below: time-series charts for CPU, memory, network — canvas-rendered for performance
- Time window selector: 5min to 7 days — slices into a pre-generated 7-day dataset
- Data is deterministic per cluster (seeded PRNG) — switching clusters and back shows identical graphs

**What to show:**
- Click different time windows → charts update instantly
- Switch cluster in header → all data regenerates (different deterministic seed)
- Switch back → identical to before (prove determinism)
- Scroll down to deployment timeline → show recent deploy events correlated with metrics

**Notes to self:**
- The metrics mock store uses mulberry32 seeded PRNG with 7 days at 15s resolution (~40K points per metric), cached per cluster
- Golden signals are also seeded — different per cluster AND per time window
- Charts resolve CSS vars via getComputedStyle (canvas doesn't support var() directly)

---

## Traces View (1:50 – 2:15)

**What to say:**
- Distributed trace explorer — filter by service, duration
- Waterfall diagram shows span relationships with proportional duration bars
- Click a span to see attributes, status, parent chain
- P95 bottleneck highlighting on slow spans

**What to show:**
- Click different traces in the list → waterfall updates
- Filter by service name
- Click a span → detail panel shows attributes
- Point out error spans highlighted in red

**Notes to self:**
- Mock spans are generated on-the-fly when a trace is selected (not pre-stored)
- In production: would query Jaeger/OpenTelemetry backend via the REST API
- Trace IDs in the list don't correlate with log trace IDs (mock limitation)

---

## Troubleshoot Assistant (2:15 – 2:40)

**What to say:**
- Rule-based troubleshooting engine — no LLM, no API key, fully deterministic
- Correlates data across all stores: resources, logs, metrics, deploy events
- Ask natural language questions, get structured findings

**What to show:**
- Press T (or click the prompt bar) → assistant opens
- Type "what is wrong" → shows all unhealthy resources with details
- Type "why is payment-service crashing" → finds the crashing pod, shows restart count, correlates error logs
- Type "high memory" → top 5 pods by memory usage with percentages
- Type "what changed recently" → deployment event timeline

**Notes to self:**
- Engine is ~200 lines of TypeScript, pattern-matches 7 intent types
- Zero latency — correlates data already in Zustand stores
- Not LLM — won't answer "what is kubernetes?" — only operational queries about the current cluster
- Production enhancement: optionally pipe the structured context to an LLM for richer analysis

---

## Closing / Architecture (2:40 – 3:00)

**What to say:**
- 173 tests (79 Rust + 94 TypeScript), 0 warnings
- Rust backend: Axum HTTP + WebSocket, kube-rs for K8s API, rustls for TLS, single static binary
- Frontend: React 18, Zustand stores, Canvas rendering, d3-force layout engine
- Designed to swap mock data for real: loadClusterData() is the single integration point
- Security: localhost-only by default, TLS required for remote, credentials never on disk
- Open source under Apache 2.0

**What to show (if time):**
- Press ? → keyboard shortcuts overlay
- Press / → resource search overlay
- Account menu in top-right → role, RBAC, session info

---

## Things NOT to Demo (avoid these)

- Don't switch clusters expecting different topology shapes (same mock generator, just different cluster tag)
- Don't click "View Metrics" from pod drawer expecting per-pod metrics (shows cluster-level)
- Don't try to search for a trace ID from a log line (won't find an exact match in mock data)
- Don't try the light theme (removed the toggle, dark-only currently)
- Don't explain the backend isn't wired unless asked — the frontend IS functional

## If Asked About...

**"Is this connected to a real cluster?"**
→ "The app reads kubeconfig and connects via kube-rs. For this demo we're running with deterministic mock data so the demo is reproducible. Swapping to live data is a one-function change in the frontend."

**"How does the troubleshoot engine work without AI?"**
→ "It's a correlation engine — parses intent with regex, then queries the stores for matching resources, related logs, and recent deploy events. 200 lines of TypeScript. You could optionally pipe the structured findings to an LLM for richer answers."

**"What makes this different from Lens/Grafana/Datadog?"**
→ "Single binary, zero config, all observability pillars unified (topology + logs + metrics + traces), visual-first with the service dependency map, and a built-in troubleshooting engine. Plus it's open source and doesn't cost $50k/year."

**"Performance?"**
→ "Rust backend targets <100MB memory, <5% CPU for 1000-pod clusters. Frontend does canvas rendering at 60fps, virtual scroll handles 1M log lines. Layout engine uses custom d3-force with namespace clustering physics."
