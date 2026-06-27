# Design Document

## Components and Interfaces

### Backend (Rust/Axum)
- **Auth_Module** — Authentication middleware, session management, OIDC integration
  - Interface: `validate_session(token: &str) -> Result<Session, AuthError>`
  - Interface: `create_session(credentials: Credentials) -> Result<SessionToken, AuthError>`
- **Cluster_Manager** — Multi-cluster connection lifecycle, context switching
  - Interface: `connect(context_name: &str) -> Result<ClusterId, ConnectionError>`
  - Interface: `list_contexts() -> Vec<ClusterContext>`
- **Query_Engine** — Data retrieval coordinator for logs, metrics, traces
  - Interface: `stream_logs(cluster: ClusterId, pod: PodRef, opts: LogOptions) -> LogStream`
  - Interface: `get_metrics(cluster: ClusterId, resource: ResourceRef, window: TimeWindow) -> TimeSeries`
  - Interface: `query_traces(cluster: ClusterId, filter: TraceFilter) -> Vec<Trace>`
- **Resource_Graph** — In-memory cluster state with watch-based updates
  - Interface: `get_snapshot() -> GraphSnapshot`
  - Interface: `subscribe_changes() -> broadcast::Receiver<GraphPatch>`
- **WebSocket_Server** — Real-time bidirectional communication with frontends
  - Interface: Handles `ClientMessage` → produces `ServerMessage` (see protocol below)
- **Plugin_Host** — Extensible data source integration
  - Interface: `trait DataSource { fn poll(&self) -> Vec<DataPoint>; }`

### Frontend (React/TypeScript)
- **TopologyView** — WebGL/Canvas cluster visualization
  - Props: `resources: ResourceGraph, filters: FilterState, onSelect: (id) => void`
- **LogViewer** — Virtualized real-time log display
  - Props: `subscriptionId: string, containers: Container[], searchQuery: string`
- **MetricsDashboard** — Time-series chart rendering
  - Props: `resource: ResourceRef, timeWindow: TimeWindow`
- **TraceExplorer** — Distributed trace waterfall
  - Props: `traces: Trace[], selectedTraceId?: string`
- **ClusterStore (Zustand)** — Central cluster state management
  - Interface: `useClusterStore() -> { resources, connections, health }`

## Data Models

### Core Backend Models (Rust)

```rust
struct ClusterContext {
    name: String,
    cluster_url: String,
    namespace: Option<String>,
    auth_info: AuthInfo,
}

struct ResourceNode {
    uid: String,
    kind: ResourceKind,
    name: String,
    namespace: Option<String>,
    status: HealthStatus,
    labels: HashMap<String, String>,
    metrics: Option<ResourceMetrics>,
    parent_uid: Option<String>,
}

enum ResourceKind {
    Node, Namespace, Deployment, ReplicaSet, StatefulSet, DaemonSet, Service, Pod, Container, CRD(String),
}

enum HealthStatus {
    Healthy, Warning(String), Critical(String), Unknown,
}

struct ResourceMetrics {
    cpu_usage_millicores: u64,
    cpu_limit_millicores: Option<u64>,
    memory_usage_bytes: u64,
    memory_limit_bytes: Option<u64>,
}

struct GraphPatch {
    op: PatchOp,
    resource: ResourceNode,
}

enum PatchOp { Add, Update, Remove }

struct Session {
    id: String,
    credentials: HashMap<String, ClusterCredential>,
    created_at: Instant,
    expires_at: Instant,
}
```

### Frontend Models (TypeScript)

```typescript
interface ResourceNode {
  uid: string;
  kind: ResourceKind;
  name: string;
  namespace?: string;
  status: HealthStatus;
  labels: Record<string, string>;
  metrics?: ResourceMetrics;
  parentUid?: string;
  clusterId: string;
}

interface LogLine {
  timestamp: string;
  container: string;
  level?: "error" | "warn" | "info" | "debug";
  message: string;
}

interface Trace {
  traceId: string;
  rootService: string;
  duration: number;
  spanCount: number;
  status: "ok" | "error";
  startTime: string;
}

interface Span {
  spanId: string;
  parentSpanId?: string;
  service: string;
  operation: string;
  duration: number;
  startTime: number;
  attributes: Record<string, string>;
  events: SpanEvent[];
  status: "ok" | "error";
}
```

## Overview

KubeObserve GUI is architected as a single-binary application with an embedded web frontend served by a high-performance Rust backend. The backend communicates with Kubernetes clusters via the official API, aggregates observability data (logs, metrics, traces), and pushes updates to the frontend over WebSocket connections. The frontend renders an interactive topology graph, log viewer, metrics dashboard, and trace explorer using modern web technologies optimized for 60fps rendering.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         KubeObserve Binary                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Rust Backend (Axum)                         │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │ Auth_Module  │  │ Query_Engine │  │ WebSocket_Server    │  │  │
│  │  │ - OIDC      │  │ - K8s Watch  │  │ - Real-time push    │  │  │
│  │  │ - SA Token  │  │ - Log Stream │  │ - Subscription mgmt │  │  │
│  │  │ - Kubeconfig│  │ - Metrics    │  │ - Backpressure      │  │  │
│  │  └─────────────┘  │ - Traces     │  └─────────────────────┘  │  │
│  │                    └──────────────┘                            │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │ Cluster_Mgr │  │ Plugin_Host  │  │ Static_File_Server  │  │  │
│  │  │ - Multi-ctx │  │ - DataSource │  │ - Embedded SPA      │  │  │
│  │  │ - RBAC      │  │ - Custom CRD │  │ - Gzip/Brotli       │  │  │
│  │  │ - Health    │  │ - Extensions │  │ - Cache headers      │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Embedded Frontend (SPA - TypeScript/React)        │  │
│  │                                                                │  │
│  │  ┌──────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │  │
│  │  │ Topology_View│ │ Log_Viewer │ │ Metrics_   │ │ Trace_   │ │  │
│  │  │ (WebGL/Canvas│ │ (Virtual   │ │ Dashboard  │ │ Explorer │ │  │
│  │  │  + D3 force) │ │  scroll)   │ │ (Canvas)   │ │ (SVG)    │ │  │
│  │  └──────────────┘ └────────────┘ └────────────┘ └──────────┘ │  │
│  │                                                                │  │
│  │  ┌──────────────┐ ┌────────────┐ ┌────────────────────────┐  │  │
│  │  │ State_Store  │ │ WS_Client  │ │ Theme_Engine           │  │  │
│  │  │ (Zustand)    │ │ (reconnect)│ │ (dark/light/custom)    │  │  │
│  │  └──────────────┘ └────────────┘ └────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│ Kubernetes API  │  │ Prometheus       │  │ OpenTelemetry/  │
│ (watch streams) │  │ (PromQL queries) │  │ Jaeger          │
└─────────────────┘  └──────────────────┘  └─────────────────┘
```

### Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend runtime | Rust (tokio async) | Performance, memory safety, single binary compilation |
| HTTP framework | Axum | Lightweight, tower-based middleware, excellent async support |
| K8s client | kube-rs | Official Rust K8s client, watch support, typed resources |
| Serialization | serde + serde_json | Zero-copy deserialization where possible, industry standard |
| WebSocket | axum + tokio-tungstenite | Native integration with Axum, low overhead |
| Frontend framework | React 18 + TypeScript | Component model suits complex UIs, large ecosystem |
| State management | Zustand | Minimal, performant, no boilerplate |
| Topology rendering | WebGL via deck.gl or pixi.js + d3-force | GPU-accelerated for 1000+ node graphs at 60fps |
| Log viewer | Custom virtualized list | Performance requirement (1M lines) demands custom solution |
| Metrics charts | uPlot | Lightweight (<10KB), GPU-accelerated canvas rendering |
| Trace waterfall | Custom SVG/Canvas | Specific layout requirements for span hierarchy |
| Build/bundle | Vite | Fast HMR in dev, optimized production bundles |
| Binary embedding | rust-embed | Compile frontend assets into binary at build time |
| TLS | rustls | Pure Rust, no OpenSSL dependency, memory safe |

### Data Flow

#### Real-Time Cluster State

1. Backend establishes K8s API watch streams per resource type (pods, deployments, services, nodes, events)
2. Watch events are normalized into a `ResourceGraph` in-memory data structure
3. Changes are diffed and broadcast to connected frontends via WebSocket as JSON patches
4. Frontend applies patches to local Zustand store and re-renders affected components

#### Log Streaming

1. Frontend requests log stream for specific container(s) via WebSocket subscription
2. Backend opens K8s log follow stream (`/api/v1/namespaces/{ns}/pods/{pod}/log?follow=true`)
3. Backend buffers and batches log lines (max 100ms or 100 lines) before forwarding to frontend
4. Frontend appends to virtualized log buffer, applying search highlighting client-side

#### Metrics Pipeline

1. Backend polls Metrics API every 15 seconds for current resource usage
2. For historical data, backend queries Prometheus (if available) with PromQL
3. Results are cached in a time-series ring buffer (in-memory, bounded)
4. Frontend requests metrics for specific resources via REST, receives time-series JSON

#### Trace Retrieval

1. Backend queries OpenTelemetry/Jaeger API for traces matching service/time criteria
2. Traces are transformed into a normalized span tree structure
3. Frontend renders waterfall using span tree, computing layout client-side

## Security Design

### Authentication Flow

```
User starts binary → Backend binds localhost:0 (random port)
                   → Backend reads kubeconfig credentials
                   → Backend opens browser to http://127.0.0.1:{port}
                   → Frontend loads (no auth needed - localhost trust model)
                   
For shared deployment:
User → TLS termination → OIDC redirect → Token validation → Session cookie → API access
```

### Security Boundaries

- **Default mode (localhost):** Trusts local user implicitly (same security model as kubectl)
- **Shared mode (TLS required):** Full OIDC/token auth, session management, RBAC enforcement
- **Credentials:** Never written to disk, held in memory-only HashMap keyed by session ID, cleared on session expiry
- **API requests to K8s:** Use the authenticated user's credentials (impersonation or token passthrough)

## Module Design

### Backend Modules

```
src/
├── main.rs                 # Entry point, CLI args, startup
├── auth/
│   ├── mod.rs              # Auth middleware, session management
│   ├── oidc.rs             # OIDC provider integration
│   ├── kubeconfig.rs       # Kubeconfig credential extraction
│   └── session.rs          # Session store (in-memory, TTL-based)
├── cluster/
│   ├── mod.rs              # Cluster connection manager
│   ├── discovery.rs        # Kubeconfig parsing, context enumeration
│   ├── watcher.rs          # K8s API watch stream management
│   ├── resource_graph.rs   # In-memory resource relationship graph
│   └── rbac.rs             # RBAC permission checking
├── query/
│   ├── mod.rs              # Query engine coordinator
│   ├── logs.rs             # Log stream management
│   ├── metrics.rs          # Metrics API + Prometheus queries
│   └── traces.rs           # OpenTelemetry/Jaeger client
├── api/
│   ├── mod.rs              # Axum router setup
│   ├── rest.rs             # REST API endpoints
│   ├── websocket.rs        # WebSocket handler, subscription management
│   └── middleware.rs       # Auth, logging, rate limiting middleware
├── plugins/
│   ├── mod.rs              # Plugin host interface
│   └── datasource.rs       # Custom data source trait
└── config.rs               # Configuration (CLI args, env vars, optional TOML)
```

### Frontend Module Structure

```
frontend/src/
├── main.tsx                # App entry, router setup
├── App.tsx                 # Layout shell, navigation
├── stores/
│   ├── cluster.ts          # Cluster state (resources, connections)
│   ├── logs.ts             # Log buffer and filter state
│   ├── metrics.ts          # Metrics time-series data
│   └── ui.ts               # UI state (theme, panels, selections)
├── components/
│   ├── topology/
│   │   ├── TopologyView.tsx     # Main canvas/WebGL topology
│   │   ├── TopologyControls.tsx # Zoom, filter, layout controls
│   │   ├── PodTooltip.tsx       # Hover tooltip
│   │   └── layout-engine.ts    # Force-directed layout computation
│   ├── logs/
│   │   ├── LogViewer.tsx        # Main log view
│   │   ├── LogLine.tsx          # Single log line renderer
│   │   ├── LogSearch.tsx        # Search/filter controls
│   │   └── virtual-scroll.ts   # Custom virtualization engine
│   ├── metrics/
│   │   ├── MetricsDashboard.tsx # Chart container
│   │   ├── TimeSeriesChart.tsx  # uPlot wrapper
│   │   └── ResourceGauge.tsx    # CPU/memory gauges
│   ├── traces/
│   │   ├── TraceExplorer.tsx    # Trace list and search
│   │   ├── WaterfallView.tsx    # Span waterfall diagram
│   │   └── SpanDetail.tsx       # Span attributes panel
│   ├── common/
│   │   ├── ClusterSelector.tsx  # Multi-cluster switcher
│   │   ├── HealthBar.tsx        # Health summary component
│   │   ├── NotificationFeed.tsx # Event notification list
│   │   └── SearchBar.tsx        # Global search
│   └── layout/
│       ├── Sidebar.tsx          # Navigation sidebar
│       ├── Panel.tsx            # Resizable panel container
│       └── StatusBar.tsx        # Bottom status bar
├── hooks/
│   ├── useWebSocket.ts     # WebSocket connection + reconnect
│   ├── useClusterData.ts   # Cluster data subscription
│   └── useTheme.ts         # Theme management
├── lib/
│   ├── ws-client.ts        # WebSocket protocol handler
│   ├── json-patch.ts       # JSON patch application
│   └── export.ts           # Log/metric export utilities
└── styles/
    ├── themes/
    │   ├── dark.css         # Dark theme variables
    │   └── light.css        # Light theme variables
    └── global.css           # Base styles, CSS reset
```

## API Design

### WebSocket Protocol

```typescript
// Client → Server messages
type ClientMessage =
  | { type: "subscribe"; channel: "topology" | "logs" | "metrics"; params: Record<string, string> }
  | { type: "unsubscribe"; channel: string; subscriptionId: string }
  | { type: "ping" }

// Server → Client messages
type ServerMessage =
  | { type: "snapshot"; channel: string; data: any }           // Initial state
  | { type: "patch"; channel: string; patches: JsonPatch[] }   // Incremental update
  | { type: "log_batch"; subscriptionId: string; lines: LogLine[] }
  | { type: "error"; code: string; message: string }
  | { type: "pong" }

interface LogLine {
  timestamp: string;
  container: string;
  level?: "error" | "warn" | "info" | "debug";
  message: string;
}

interface JsonPatch {
  op: "add" | "remove" | "replace";
  path: string;
  value?: any;
}
```

### REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/contexts | List available cluster contexts |
| POST | /api/v1/contexts/{name}/connect | Connect to cluster |
| GET | /api/v1/clusters/{id}/resources | Get resource graph snapshot |
| GET | /api/v1/clusters/{id}/pods/{ns}/{name}/logs | Get historical logs |
| GET | /api/v1/clusters/{id}/metrics/{resource_type}/{ns}/{name} | Get metrics |
| GET | /api/v1/clusters/{id}/traces | Query traces |
| GET | /api/v1/clusters/{id}/traces/{traceId} | Get trace detail |
| GET | /api/v1/health | Backend health check |
| POST | /api/v1/export/logs | Export logs to file |
| POST | /api/v1/export/metrics | Export metrics to CSV |

## Performance Strategy

### Backend Optimizations

- **Watch streams over polling:** Use K8s informer pattern for O(1) updates vs O(n) list operations
- **Zero-copy serialization:** Use `serde` with `Bytes` for log forwarding to minimize allocations
- **Bounded buffers:** Ring buffers for metrics history, bounded channels for log streaming
- **Connection pooling:** Reuse HTTP/2 connections to K8s API across all watch streams
- **Lazy loading:** Only fetch detailed data (logs, events) when user requests it

### Frontend Optimizations

- **WebGL topology:** GPU-accelerated rendering for 1000+ node graphs
- **Virtual scrolling:** Only render visible log lines, O(1) scroll performance
- **JSON patching:** Receive diffs instead of full state, minimize re-renders
- **Web Workers:** Offload layout computation and search to background threads
- **Canvas metrics:** uPlot renders directly to canvas, bypasses DOM

## Error Handling

### Backend Error Strategy

| Error Category | Handling Approach | User Impact |
|----------------|-------------------|-------------|
| Cluster connection failure | Return typed error with reason + remediation | Toast notification with suggested fix |
| Watch stream disconnection | Automatic reconnect with exponential backoff (max 30s) | Stale indicator shown, auto-resolves |
| RBAC permission denied | Log and exclude resource from graph, report in UI | Partial data with clear "insufficient permissions" indicator |
| Kubeconfig parse failure | Return specific field/line error | Startup error message with fix instructions |
| Prometheus unavailable | Graceful degradation, use Metrics API only | Metrics limited to current values, no history |
| Trace backend unavailable | Disable Trace_Explorer tab | Tab disabled with tooltip explaining why |
| WebSocket backpressure | Drop oldest queued messages, send resync signal | Brief stale state, then automatic catch-up |
| Session expiry | Return 401, frontend prompts re-auth | Re-auth modal, current view state preserved |
| Out of memory (ring buffer) | Evict oldest entries, bounded allocation | Oldest metrics/logs unavailable |
| Plugin crash | Isolate failure, disable plugin, log error | Plugin data unavailable, notification shown |

### Frontend Error Strategy

- **Network errors:** Show connection status indicator, queue retry
- **Render errors:** React error boundaries per view, graceful fallback
- **WebSocket disconnect:** Automatic reconnect with visual indicator, request fresh snapshot on reconnect
- **Data parse errors:** Log and skip malformed messages, do not crash viewer

## Testing Strategy

### Unit Tests
- **Backend:** Rust `#[cfg(test)]` modules for each component — resource graph operations, session management, kubeconfig parsing, log batching, JSON patch generation
- **Frontend:** Vitest for store logic, hook behavior, utility functions, layout engine computations

### Integration Tests
- **Backend:** Test against mock K8s API server (using `kube-rs` test utilities) — verify watch stream processing, REST API responses, WebSocket protocol handling
- **Frontend:** React Testing Library for component interaction flows — topology click/hover, log viewer scroll, filter application

### Property-Based Tests
- Resource graph invariant (no dangling parent references after arbitrary event sequences)
- Log merge completeness (union of inputs == output for arbitrary log sets)
- Filter idempotence (applying filter twice == applying once)
- Ring buffer bounded memory (size never exceeds capacity after arbitrary insert sequences)
- JSON patch round-trip (apply(snapshot, patches) == new_snapshot for generated patch sequences)

### End-to-End Tests
- Full startup → connect → visualize flow against a k3s/kind cluster in CI
- Multi-cluster switching with concurrent data streams
- TLS mode authentication flow

### Performance Benchmarks
- Topology render time for 100, 500, 1000 pod clusters
- Log viewer scroll performance at 100K and 1M line buffers
- Memory usage under sustained watch stream load
- Binary size verification (< 50MB compressed)

## Correctness Properties

### Property 1: Resource Graph Consistency
FOR ALL resources in the Resource_Graph, each resource's parent reference SHALL resolve to an existing resource in the graph (no dangling references after watch event processing).
- Category: Invariant
- **Validates: Requirements 2.1, 2.5**

### Property 2: Log Ordering Invariant
FOR ALL log lines displayed in the Log_Viewer for a single container, timestamps SHALL be monotonically non-decreasing.
- Category: Invariant
- **Validates: Requirements 3.1, 3.4**

### Property 3: Multi-Container Log Merge Completeness
FOR ALL interleaved multi-container log displays, the merged output SHALL contain exactly the union of all individual container logs with no duplicates or omissions.
- Category: Metamorphic (len(merged) == sum(len(individual)))
- **Validates: Requirements 3.4**

### Property 4: Session Security Invariant
FOR ALL API requests, IF the request does not carry a valid session token or localhost origin, THEN the response SHALL be 401 Unauthorized.
- Category: Invariant
- **Validates: Requirements 6.1, 6.9**

### Property 5: RBAC Passthrough
FOR ALL resource queries, the returned resources SHALL be a subset of resources accessible with the user's Kubernetes credentials.
- Category: Invariant
- **Validates: Requirements 6.3**

### Property 6: Watch Convergence
FOR ALL connected clients, the displayed resource state SHALL converge to the actual cluster state within the staleness bound (5 seconds) after any cluster change.
- Category: Model-based (eventual consistency model)
- **Validates: Requirements 2.5**

### Property 7: Metrics Bounded Memory
The in-memory metrics ring buffer SHALL never exceed its configured capacity — oldest entries are evicted when capacity is reached.
- Category: Invariant (bounded collection size)
- **Validates: Requirements 7.1**

### Property 8: WebSocket Reconnection
FOR ALL temporary network interruptions lasting less than 30 seconds, the WebSocket client SHALL automatically reconnect and resynchronize state without user intervention.
- Category: Round-trip (disconnect → reconnect → state matches)
- **Validates: Requirements 7.6**

### Property 9: Filter Idempotence
Applying the same filter criteria twice to the Cluster_Topology_View SHALL produce identical results.
- Category: Idempotence (f(x) == f(f(x)))
- **Validates: Requirements 2.7**

### Property 10: Export Completeness
FOR ALL log exports, the exported file SHALL contain exactly the log lines visible in the current filtered view, in display order.
- Category: Round-trip (view state → export → parse → equals view state)
- **Validates: Requirements 10.1**
- Tested by: Requirement 10 AC 1
