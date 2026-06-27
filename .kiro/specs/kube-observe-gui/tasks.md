# Implementation Plan:

## Overview

This implementation plan covers the full build-out of KubeObserve GUI — a Rust-backed, browser-rendered Kubernetes observability tool. The work is organized in 12 phases progressing from core infrastructure through feature modules to final polish and distribution. Each phase builds on previous ones, with the critical path being: scaffolding → auth → cluster connection → WebSocket → topology → logs/metrics/traces → multi-cluster → distribution.

## Tasks

## Phase 1: Project Scaffolding and Core Backend

### 1.1 Initialize Rust workspace and project structure
- [ ] 1.1.1 Create Rust workspace with `cargo init` using edition 2021
- [ ] 1.1.2 Set up directory structure: `src/auth/`, `src/cluster/`, `src/query/`, `src/api/`, `src/plugins/`
- [ ] 1.1.3 Add core dependencies to Cargo.toml: tokio, axum, serde, serde_json, kube-rs, tower, tracing
- [ ] 1.1.4 Configure CI-friendly Cargo settings (release profile, LTO, strip symbols for <50MB binary)
- [ ] 1.1.5 Create `src/config.rs` with CLI argument parsing (clap) and environment variable support

### 1.2 Initialize frontend project
- [ ] 1.2.1 Scaffold React + TypeScript project with Vite in `frontend/` directory
- [ ] 1.2.2 Install core dependencies: react, zustand, d3-force, uplot
- [ ] 1.2.3 Set up directory structure: `stores/`, `components/`, `hooks/`, `lib/`, `styles/`
- [ ] 1.2.4 Configure Vite build output for embedding (asset paths, output directory)
- [ ] 1.2.5 Set up CSS variable-based theme system with dark and light mode

### 1.3 Binary embedding and static file serving
- [ ] 1.3.1 Add rust-embed dependency and configure it to embed `frontend/dist/` at compile time
- [ ] 1.3.2 Implement Axum handler to serve embedded static files with proper MIME types
- [ ] 1.3.3 Add Brotli/Gzip compression middleware for static assets
- [ ] 1.3.4 Configure cache headers for immutable assets (content-hashed filenames)
- [ ] 1.3.5 Implement SPA fallback (serve index.html for non-API, non-asset routes)

### 1.4 Phase 1 Test Suite: Core Infrastructure Validation
- [ ]* 1.4.1 Write unit tests for project scaffolding and configuration
  - Test CLI argument parsing with valid/invalid inputs
  - Test environment variable loading and defaults
  - Test Vite build output configuration and asset embedding
  - _Requirements: 1.1, 7.1_

- [ ]* 1.4.2 Write integration tests for static file serving
  - Test embedded file serving with correct MIME types
  - Test SPA fallback routing (non-API paths serve index.html)
  - Test Brotli/Gzip compression headers
  - Test cache header correctness for hashed assets
  - _Requirements: 7.1_

- [ ]* 1.4.3 Stress test: binary startup and static file serving under load
  - Benchmark binary cold-start time (target < 2 seconds)
  - Load test static file serving at 1000 concurrent requests
  - Verify memory footprint stays below 100MB at idle
  - Measure response latency p99 for embedded assets under load
  - _Requirements: 7.1, 7.5_

## Phase 2: Authentication and Security

### 2.1 Kubeconfig credential extraction
- [ ] 2.1.1 Implement kubeconfig file discovery (default path + KUBECONFIG env var merging)
- [ ] 2.1.2 Parse kubeconfig YAML into typed structs with serde
- [ ] 2.1.3 Extract and enumerate available contexts with cluster/user/namespace info
- [ ] 2.1.4 Handle credential types: client certificates, bearer tokens, exec-based credentials
- [ ] 2.1.5 Report descriptive errors for malformed or missing kubeconfig files

### 2.2 Session management
- [ ] 2.2.1 Implement in-memory session store with TTL-based expiration (default 8 hours)
- [ ] 2.2.2 Generate cryptographically secure session tokens using `rand`
- [ ] 2.2.3 Implement session middleware that validates tokens on every request
- [ ] 2.2.4 Store cluster credentials per session (memory only, cleared on expiry)
- [ ] 2.2.5 Implement session renewal without losing frontend state

### 2.3 Localhost trust and TLS modes
- [ ] 2.3.1 Implement default localhost-only binding (127.0.0.1, random port)
- [ ] 2.3.2 Open user's default browser to the bound address on startup
- [ ] 2.3.3 Implement TLS configuration with rustls for non-localhost mode
- [ ] 2.3.4 Enforce minimum TLS 1.2 and reject connections on lower versions
- [ ] 2.3.5 Implement OIDC authentication flow for shared deployment mode
- [ ] 2.3.6 Ensure no management/debug endpoints are accessible without authentication

### 2.4 Phase 2 Test Suite: Authentication and Security Validation
- [ ]* 2.4.1 Write unit tests for authentication components
  - Test kubeconfig file discovery with various path configurations
  - Test credential extraction for all types (certs, tokens, exec)
  - Test session creation, validation, and expiration logic
  - Test TLS configuration enforcement (reject < TLS 1.2)
  - _Requirements: 6.1, 6.2, 6.3, 6.9_

- [ ]* 2.4.2 Write integration tests for auth flow end-to-end
  - Test full login flow: kubeconfig read → session create → token validate
  - Test session renewal without state loss
  - Test OIDC redirect flow in shared deployment mode
  - Test 401 response for expired/invalid sessions on all endpoints
  - _Requirements: 6.1, 6.2, 6.9_

- [ ]* 2.4.3 Write property tests for session security
  - **Property 4: Session Security Invariant**
  - Verify that FOR ALL API requests without valid session token, response is 401
  - **Validates: Requirements 6.1, 6.9**

- [ ]* 2.4.4 Stress test: authentication under brute-force and concurrent load
  - Simulate 1000 concurrent login attempts with invalid credentials
  - Measure session validation latency under 500 concurrent authenticated requests
  - Verify no session leakage under rapid create/expire cycles (10K sessions)
  - Verify memory is properly freed after session expiry under sustained load
  - Test TLS handshake throughput at 100 concurrent connections
  - _Requirements: 6.1, 6.9_

## Phase 3: Cluster Connection and Resource Graph

### 3.1 Cluster connection management
- [ ] 3.1.1 Implement cluster connection using kube-rs Client from kubeconfig context
- [ ] 3.1.2 Add connection timeout (3 seconds) and retry with backoff
- [ ] 3.1.3 Verify minimum RBAC permissions on connection (list pods, get nodes)
- [ ] 3.1.4 Report unavailable data sources due to RBAC restrictions
- [ ] 3.1.5 Support simultaneous connections to up to 10 clusters

### 3.2 Kubernetes watch streams
- [ ] 3.2.1 Implement watch stream for Pods using kube-rs watcher/reflector pattern
- [ ] 3.2.2 Implement watch streams for Deployments, Services, Nodes, Namespaces
- [ ] 3.2.3 Implement watch stream for Events (pod evictions, OOMKills, scheduling failures)
- [ ] 3.2.4 Handle watch stream reconnection on disconnect (bookmark resume)
- [ ] 3.2.5 Implement bounded event queue to prevent unbounded memory growth

### 3.3 Resource graph construction
- [ ] 3.3.1 Define ResourceGraph data structure with nodes and edges (ownership, selection, networking)
- [ ] 3.3.2 Implement graph update logic from watch events (add, modify, delete)
- [ ] 3.3.3 Compute resource relationships: Deployment→ReplicaSet→Pod, Service→Pod (label selector)
- [ ] 3.3.4 Implement graph diffing to produce JSON patches for frontend updates
- [ ] 3.3.5 Add health status computation per resource (running, pending, error, crashloop)
- [ ] 3.3.6 Support CRD instances as first-class nodes in the resource graph

### 3.4 Phase 3 Test Suite: Cluster Connection and Resource Graph Validation
- [ ]* 3.4.1 Write unit tests for cluster connection and resource graph
  - Test cluster connection with valid/invalid kubeconfig contexts
  - Test connection timeout and retry backoff behavior
  - Test RBAC permission verification and graceful degradation
  - Test resource graph add/modify/delete operations
  - Test health status computation for all resource kinds
  - _Requirements: 2.1, 2.5, 6.3_

- [ ]* 3.4.2 Write integration tests for watch streams and graph construction
  - Test watch stream subscription and event processing against mock K8s API
  - Test resource relationship computation (Deployment→ReplicaSet→Pod, Service→Pod)
  - Test graph diffing produces correct JSON patches
  - Test CRD instance integration into resource graph
  - Test watch stream reconnection after simulated disconnect
  - _Requirements: 2.1, 2.5_

- [ ]* 3.4.3 Write property tests for resource graph consistency
  - **Property 1: Resource Graph Consistency**
  - Verify FOR ALL resources, parent references resolve to existing resources after arbitrary event sequences
  - **Property 5: RBAC Passthrough**
  - Verify returned resources are always a subset of accessible resources
  - **Property 6: Watch Convergence**
  - Verify displayed state converges to actual cluster state within 5 seconds
  - **Validates: Requirements 2.1, 2.5, 6.3**

- [ ]* 3.4.4 Stress test: resource graph at scale
  - Benchmark resource graph construction with 1000+ pods across 50 namespaces
  - Stress test watch stream processing at 500 events/second sustained
  - Verify bounded event queue prevents memory growth under event flood (10K events/sec)
  - Measure graph diff computation latency at 1000+ node graphs
  - Test simultaneous connections to 10 clusters with concurrent watch streams
  - Verify memory usage remains bounded under continuous watch churn
  - _Requirements: 2.1, 2.5, 7.5_

## Phase 4: WebSocket Server and Real-Time Communication

### 4.1 WebSocket infrastructure
- [ ] 4.1.1 Implement WebSocket upgrade handler in Axum with authentication check
- [ ] 4.1.2 Define typed message protocol (subscribe, unsubscribe, ping/pong, snapshot, patch)
- [ ] 4.1.3 Implement subscription management (track which clients subscribe to which channels)
- [ ] 4.1.4 Implement backpressure handling — drop oldest updates if client falls behind
- [ ] 4.1.5 Implement server-side heartbeat and dead connection cleanup

### 4.2 Frontend WebSocket client
- [ ] 4.2.1 Implement WebSocket client with automatic reconnection (exponential backoff, max 30s)
- [ ] 4.2.2 Implement state resynchronization on reconnect (request fresh snapshot)
- [ ] 4.2.3 Implement JSON patch application to Zustand store
- [ ] 4.2.4 Implement ping/pong keepalive mechanism
- [ ] 4.2.5 Add connection status indicator in the UI (connected, reconnecting, disconnected)

### 4.3 Phase 4 Test Suite: WebSocket and Real-Time Communication Validation
- [ ]* 4.3.1 Write unit tests for WebSocket protocol
  - Test message serialization/deserialization for all client and server message types
  - Test subscription management (subscribe, unsubscribe, track channels)
  - Test backpressure handling and oldest-message dropping
  - Test heartbeat and dead connection detection logic
  - Test JSON patch application to Zustand store
  - _Requirements: 7.6_

- [ ]* 4.3.2 Write integration tests for WebSocket end-to-end
  - Test full flow: connect → authenticate → subscribe → receive snapshot → receive patches
  - Test reconnection with state resynchronization
  - Test multi-client subscription isolation (client A's subscription doesn't leak to client B)
  - Test ping/pong keepalive under delayed responses
  - _Requirements: 7.6_

- [ ]* 4.3.3 Write property tests for WebSocket correctness
  - **Property 8: WebSocket Reconnection**
  - Verify FOR ALL temporary interruptions < 30s, client reconnects and resyncs without user action
  - **Validates: Requirements 7.6**

- [ ]* 4.3.4 Stress test: WebSocket under concurrent client load
  - Test 100 concurrent WebSocket clients all subscribing to topology channel
  - Measure message delivery latency p95 under 100 clients receiving simultaneous updates
  - Stress test backpressure: 100 slow clients while pushing 1000 patches/second
  - Verify no memory leaks after rapid connect/disconnect cycles (10K connections)
  - Benchmark throughput: maximum sustainable messages/second per client
  - Test reconnection storm: 100 clients disconnecting and reconnecting simultaneously
  - _Requirements: 7.6, 7.5_

## Phase 5: Topology Visualization

### 5.1 Topology layout engine
- [ ] 5.1.1 Implement force-directed layout using d3-force in a Web Worker
- [ ] 5.1.2 Configure force parameters: charge repulsion, link distance by relationship type, collision avoidance
- [ ] 5.1.3 Implement hierarchical grouping (namespace boundaries, node boundaries)
- [ ] 5.1.4 Optimize layout for clusters up to 500 pods (< 2 second computation)
- [ ] 5.1.5 Implement incremental layout updates (add/remove nodes without full recalculation)

### 5.2 WebGL/Canvas rendering
- [ ] 5.2.1 Set up WebGL or Canvas rendering context for topology view
- [ ] 5.2.2 Implement node rendering with resource-type-specific icons and status colors
- [ ] 5.2.3 Implement edge rendering with relationship-type styling (ownership=solid, network=dashed)
- [ ] 5.2.4 Implement smooth zoom, pan, and fit-to-screen with 60fps animation
- [ ] 5.2.5 Implement hit-testing for hover and click detection on nodes

### 5.3 Topology interactions
- [ ] 5.3.1 Implement hover tooltip showing pod name, status, age, restart count, CPU/memory
- [ ] 5.3.2 Implement click-to-inspect opening Pod_Inspector panel
- [ ] 5.3.3 Implement namespace/label/status filter with < 500ms re-render
- [ ] 5.3.4 Implement visual status indicators (color coding + icon overlay for non-running pods)
- [ ] 5.3.5 Implement real-time state updates with animated transitions between states
- [ ] 5.3.6 Implement health summary bar (healthy/warning/critical counts)

### 5.4 Phase 5 Test Suite: Topology Visualization Validation
- [ ]* 5.4.1 Write unit tests for topology components
  - Test force-directed layout parameter calculations
  - Test hierarchical grouping logic (namespace/node boundaries)
  - Test incremental layout updates (add/remove nodes without full recalculation)
  - Test hit-testing accuracy for node hover/click detection
  - Test filter application and re-render logic
  - _Requirements: 2.1, 2.7_

- [ ]* 5.4.2 Write integration tests for topology view end-to-end
  - Test topology renders correctly from resource graph snapshot
  - Test real-time updates: new pod appears → layout updates → node visible
  - Test click-to-inspect opens Pod Inspector with correct data
  - Test filter application produces correct subset of visible nodes
  - Test zoom/pan/fit-to-screen interactions
  - _Requirements: 2.1, 2.5, 2.7_

- [ ]* 5.4.3 Write property tests for topology correctness
  - **Property 9: Filter Idempotence**
  - Verify applying the same filter twice produces identical results
  - **Validates: Requirements 2.7**

- [ ]* 5.4.4 Stress test: topology rendering at scale
  - Benchmark layout computation time for 100, 500, 1000, 2000 pod clusters
  - Verify < 2 second layout time for 500 pods target
  - Measure frame rate during zoom/pan with 1000+ visible nodes (target 60fps)
  - Stress test incremental updates: 100 pod add/remove operations per second
  - Measure memory usage of WebGL/Canvas context with 2000 rendered nodes
  - Test filter re-render latency at 1000+ nodes (target < 500ms)
  - _Requirements: 2.1, 7.5_

## Phase 6: Log Viewer

### 6.1 Backend log streaming
- [ ] 6.1.1 Implement K8s log follow stream via kube-rs pod log API
- [ ] 6.1.2 Implement log line batching (max 100ms or 100 lines per batch)
- [ ] 6.1.3 Support multi-container log streaming with container identification
- [ ] 6.1.4 Detect and indicate container restart boundaries in log stream
- [ ] 6.1.5 Implement time-range-based historical log retrieval (sinceTime parameter)

### 6.2 Frontend log rendering
- [ ] 6.2.1 Implement custom virtual scrolling engine supporting 1M+ lines at 60fps
- [ ] 6.2.2 Implement log line parsing: timestamp extraction, severity detection
- [ ] 6.2.3 Implement color-coded container identifiers for multi-container views
- [ ] 6.2.4 Implement chronological interleaving of multi-container logs
- [ ] 6.2.5 Implement auto-scroll with "pinned to bottom" behavior and manual scroll override

### 6.3 Log search and filtering
- [ ] 6.3.1 Implement text search with match highlighting across log buffer (< 200ms for 100K lines)
- [ ] 6.3.2 Implement match navigation (next/previous) with scroll-to-match
- [ ] 6.3.3 Implement severity level filtering (error, warning, info, debug)
- [ ] 6.3.4 Implement time range filter for displayed logs
- [ ] 6.3.5 Implement log export to local file (plain text and JSON formats)

### 6.4 Phase 6 Test Suite: Log Viewer Validation
- [ ]* 6.4.1 Write unit tests for log streaming and rendering
  - Test log line parsing: timestamp extraction, severity detection
  - Test batching logic (100ms or 100 lines threshold)
  - Test multi-container log interleaving and chronological ordering
  - Test container restart boundary detection
  - Test search match highlighting and navigation
  - Test virtual scroll position calculations
  - _Requirements: 3.1, 3.4_

- [ ]* 6.4.2 Write integration tests for log viewer end-to-end
  - Test full flow: subscribe → stream → render → search → export
  - Test multi-container view displays all containers with color coding
  - Test time-range-based historical log retrieval
  - Test auto-scroll behavior and manual scroll override
  - Test log export produces correct file content
  - _Requirements: 3.1, 3.4, 10.1_

- [ ]* 6.4.3 Write property tests for log correctness
  - **Property 2: Log Ordering Invariant**
  - Verify FOR ALL log lines in single container, timestamps are monotonically non-decreasing
  - **Property 3: Multi-Container Log Merge Completeness**
  - Verify merged output contains exactly the union of individual container logs
  - **Property 10: Export Completeness**
  - Verify exported file contains exactly the visible filtered log lines in display order
  - **Validates: Requirements 3.1, 3.4, 10.1**

- [ ]* 6.4.4 Stress test: log viewer performance at scale
  - Benchmark virtual scroll rendering at 100K, 500K, and 1M log lines
  - Verify 60fps scroll performance at 1M lines
  - Measure search latency across 100K lines (target < 200ms)
  - Stress test log ingestion: 10K lines/second sustained for 5 minutes
  - Measure memory usage growth over time with continuous log streaming
  - Test 10 simultaneous log streams from different containers
  - Benchmark time-to-first-render with large historical log fetch (50K lines)
  - _Requirements: 3.1, 7.5_

## Phase 7: Metrics Dashboard

### 7.1 Backend metrics collection
- [ ] 7.1.1 Implement Kubernetes Metrics API polling at 15-second intervals
- [ ] 7.1.2 Implement in-memory ring buffer for metrics time-series (bounded memory)
- [ ] 7.1.3 Implement Prometheus discovery and PromQL query execution (optional data source)
- [ ] 7.1.4 Implement REST endpoints for metrics retrieval by resource type/name/namespace
- [ ] 7.1.5 Support configurable time windows: 5min, 1h, 6h, 24h, 7d

### 7.2 Frontend metrics rendering
- [ ] 7.2.1 Integrate uPlot for time-series chart rendering (CPU, memory, network, disk)
- [ ] 7.2.2 Implement chart zoom and pan with smooth animation
- [ ] 7.2.3 Implement resource gauges showing current usage vs limits
- [ ] 7.2.4 Implement 80% threshold visual indicator (color change for at-risk resources)
- [ ] 7.2.5 Implement metrics CSV export
- [ ] 7.2.6 Implement time window selector (5min, 1h, 6h, 24h, 7d)

### 7.3 Phase 7 Test Suite: Metrics Dashboard Validation
- [ ]* 7.3.1 Write unit tests for metrics collection and rendering
  - Test Metrics API polling and data normalization
  - Test ring buffer insertion, eviction, and capacity enforcement
  - Test PromQL query construction and result parsing
  - Test time window selection logic (5min, 1h, 6h, 24h, 7d)
  - Test 80% threshold detection and visual indicator trigger
  - Test CSV export format correctness
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 7.3.2 Write integration tests for metrics pipeline end-to-end
  - Test full flow: poll → store → REST query → chart render
  - Test Prometheus integration with mock Prometheus server
  - Test graceful degradation when Prometheus is unavailable
  - Test chart zoom/pan interactions with real time-series data
  - Test metric export produces valid CSV
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 7.3.3 Write property tests for metrics correctness
  - **Property 7: Metrics Bounded Memory**
  - Verify ring buffer never exceeds configured capacity after arbitrary insert sequences
  - **Validates: Requirements 7.1**

- [ ]* 7.3.4 Stress test: metrics collection and rendering under load
  - Benchmark polling and storage with 1000 pods reporting metrics simultaneously
  - Verify ring buffer memory stays bounded under 24h of continuous collection
  - Stress test PromQL queries with 100 concurrent metric requests
  - Measure chart render time with 7-day time window (10K+ data points)
  - Test 15-second polling under degraded API response times (2-3s latency)
  - Benchmark memory usage across all supported time windows
  - Verify no data loss during polling interval transitions
  - _Requirements: 4.1, 7.1, 7.5_

## Phase 8: Trace Explorer

### 8.1 Trace backend integration
- [ ] 8.1.1 Implement OpenTelemetry Collector / Jaeger API client discovery
- [ ] 8.1.2 Implement trace query by service name, duration, status code, time range
- [ ] 8.1.3 Transform traces into normalized span tree structure
- [ ] 8.1.4 Implement p95 latency computation per service for bottleneck detection
- [ ] 8.1.5 Link spans to related logs when correlation IDs are available

### 8.2 Frontend trace visualization
- [ ] 8.2.1 Implement trace list view with service filter, duration filter, and time range
- [ ] 8.2.2 Implement waterfall diagram rendering (SVG/Canvas) with parent-child span relationships
- [ ] 8.2.3 Implement span duration bars with proportional widths and service color coding
- [ ] 8.2.4 Highlight spans exceeding p95 latency as potential bottlenecks
- [ ] 8.2.5 Implement span detail panel showing attributes, events, and linked logs
- [ ] 8.2.6 Implement click-through from topology service node to trace explorer

### 8.3 Phase 8 Test Suite: Trace Explorer Validation
- [ ]* 8.3.1 Write unit tests for trace backend and rendering
  - Test trace query construction with various filter combinations
  - Test span tree normalization from raw trace data
  - Test p95 latency computation accuracy
  - Test correlation ID-based log-to-span linking
  - Test waterfall layout computation for nested spans
  - Test span duration bar proportional width calculations
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 8.3.2 Write integration tests for trace explorer end-to-end
  - Test full flow: query → transform → render waterfall → click span → show detail
  - Test Jaeger API integration with mock server
  - Test OpenTelemetry Collector integration with mock server
  - Test click-through from topology view to trace explorer
  - Test trace filtering by service, duration, and status
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 8.3.3 Stress test: trace exploration at scale
  - Benchmark trace query performance with 10K traces in result set
  - Measure waterfall render time for traces with 500+ spans
  - Stress test concurrent trace queries (50 simultaneous requests)
  - Verify memory usage with large span trees (1000+ spans per trace)
  - Test p95 computation performance across 100K spans
  - Benchmark click-through navigation latency from topology to trace
  - _Requirements: 5.1, 5.2, 7.5_

## Phase 9: Multi-Cluster and Unified Search

### 9.1 Multi-cluster management
- [ ] 9.1.1 Implement cluster context selector UI with visual cluster distinction
- [ ] 9.1.2 Implement single-click cluster switching with < 3 second transition
- [ ] 9.1.3 Maintain independent resource graphs per cluster in backend
- [ ] 9.1.4 Implement color coding / iconography to distinguish clusters in all views
- [ ] 9.1.5 Handle cluster disconnection gracefully (indicate stale data, allow reconnect)

### 9.2 Unified search
- [ ] 9.2.1 Implement global search bar that queries across all connected clusters
- [ ] 9.2.2 Support search by resource name, namespace, label, and annotation
- [ ] 9.2.3 Display search results with cluster context indicator
- [ ] 9.2.4 Implement click-to-navigate from search results to resource in topology/detail view

### 9.3 Phase 9 Test Suite: Multi-Cluster and Search Validation
- [ ]* 9.3.1 Write unit tests for multi-cluster and search
  - Test cluster context switching logic and state isolation
  - Test independent resource graph maintenance per cluster
  - Test search query parsing and matching across resource types
  - Test search results ranking and cluster context annotation
  - Test cluster disconnection detection and stale data indicators
  - _Requirements: 2.1, 2.5_

- [ ]* 9.3.2 Write integration tests for multi-cluster end-to-end
  - Test switching between 3 clusters with < 3 second transition
  - Test search returns results from all connected clusters
  - Test navigation from search result to correct cluster's topology
  - Test graceful handling of cluster disconnection mid-session
  - Test color coding/iconography distinction across clusters in all views
  - _Requirements: 2.1, 2.5_

- [ ]* 9.3.3 Stress test: multi-cluster at scale
  - Benchmark cluster switching latency with 5, 8, 10 connected clusters
  - Stress test search across 10 clusters with 1000 pods each (10K total resources)
  - Measure memory usage with 10 simultaneous cluster connections and active watch streams
  - Test rapid cluster switching (10 switches in 5 seconds)
  - Verify no cross-cluster data contamination under concurrent updates
  - Benchmark search response time across 10K resources (target < 500ms)
  - _Requirements: 2.1, 7.5_

## Phase 10: Alerting, Notifications, and Health Indicators

### 10.1 Health computation and indicators
- [ ] 10.1.1 Implement pod health rules: CrashLoopBackOff, >3 restarts in 10min = critical
- [ ] 10.1.2 Implement node health rules: memory/CPU pressure conditions = warning
- [ ] 10.1.3 Implement deployment health: fewer ready replicas than desired = warning
- [ ] 10.1.4 Aggregate health into cluster-level summary (healthy/warning/critical counts)
- [ ] 10.1.5 Implement health indicator click-through to resource detail view

### 10.2 Notification feed
- [ ] 10.2.1 Implement event notification feed component (sortable by timestamp)
- [ ] 10.2.2 Subscribe to K8s Events for: pod evictions, OOMKills, failed scheduling, image pull errors
- [ ] 10.2.3 Implement notification severity coloring and grouping
- [ ] 10.2.4 Implement notification feed filtering by severity and resource type
- [ ] 10.2.5 Limit notification feed to recent events (configurable retention window)

### 10.3 Phase 10 Test Suite: Alerting and Health Indicators Validation
- [ ]* 10.3.1 Write unit tests for health computation and notifications
  - Test pod health rules: CrashLoopBackOff, restart threshold detection
  - Test node health rules: memory/CPU pressure conditions
  - Test deployment health: ready replica count comparison
  - Test health aggregation into cluster-level summary
  - Test notification feed sorting, filtering, and retention limits
  - _Requirements: 2.1, 2.5_

- [ ]* 10.3.2 Write integration tests for alerting end-to-end
  - Test full flow: K8s Event → health computation → notification feed → click-through
  - Test notification severity coloring and grouping accuracy
  - Test health indicator updates in real-time as pod status changes
  - Test event subscription for OOMKills, evictions, scheduling failures
  - Test configurable retention window enforcement
  - _Requirements: 2.1, 2.5_

- [ ]* 10.3.3 Stress test: alerting under event storm
  - Simulate event storm: 500 pod failures in 60 seconds
  - Verify notification feed remains responsive under high event volume
  - Measure health computation latency with 1000 pods in mixed states
  - Test memory usage of notification feed with 10K events in retention window
  - Benchmark cluster-level health aggregation at 50-namespace scale
  - Verify no dropped events under sustained 100 events/second load
  - _Requirements: 2.1, 7.5_

## Phase 11: Extensibility and Plugin System

### 11.1 Plugin host interface
- [ ] 11.1.1 Define Rust trait for custom data source plugins (DataSource trait)
- [ ] 11.1.2 Implement plugin loading mechanism (compiled-in or dynamic library)
- [ ] 11.1.3 Implement plugin lifecycle management (init, poll, shutdown)
- [ ] 11.1.4 Route plugin data to appropriate frontend components via standard channels

### 11.2 REST API and data export
- [ ] 11.2.1 Implement REST API endpoints as documented in design (contexts, resources, logs, metrics, traces)
- [ ] 11.2.2 Protect all REST endpoints with Auth_Module session validation
- [ ] 11.2.3 Implement log export endpoint (plain text and JSON)
- [ ] 11.2.4 Implement metrics export endpoint (CSV format)
- [ ] 11.2.5 Document REST API with OpenAPI specification

### 11.3 Phase 11 Test Suite: Extensibility and API Validation
- [ ]* 11.3.1 Write unit tests for plugin system and REST API
  - Test DataSource trait implementation with mock plugins
  - Test plugin lifecycle management (init, poll, shutdown)
  - Test plugin failure isolation (one plugin crash doesn't affect others)
  - Test REST API endpoint responses for all documented routes
  - Test auth middleware enforcement on all REST endpoints
  - _Requirements: 6.1, 6.9_

- [ ]* 11.3.2 Write integration tests for plugin and API end-to-end
  - Test plugin data routing to frontend components via standard channels
  - Test log export endpoint produces valid plain text and JSON
  - Test metrics export endpoint produces valid CSV
  - Test REST API against OpenAPI specification (schema validation)
  - Test all REST endpoints require authentication in shared mode
  - _Requirements: 6.1, 10.1_

- [ ]* 11.3.3 Stress test: REST API and plugin system under load
  - Benchmark REST API throughput: 1000 requests/second across all endpoints
  - Stress test log export with 1M line log buffer
  - Stress test metrics export with 7-day time window data
  - Test 10 plugins polling simultaneously with varying data rates
  - Measure plugin host memory overhead with 10 active plugins
  - Verify API response latency p99 under concurrent load (50 clients)
  - _Requirements: 7.5, 10.1_

## Phase 12: Polish, Packaging, and Distribution

### 12.1 UI polish and theming
- [ ] 12.1.1 Implement dark mode theme with CSS variables
- [ ] 12.1.2 Implement light mode theme
- [ ] 12.1.3 Implement theme toggle with system preference detection
- [ ] 12.1.4 Add keyboard shortcuts for common navigation (switch views, search, filter)
- [ ] 12.1.5 Implement responsive layout for various screen sizes
- [ ] 12.1.6 Add loading states and skeleton screens for all async operations

### 12.2 Build and distribution
- [ ] 12.2.1 Configure cross-compilation targets: linux-x86_64, linux-aarch64, macos-x86_64, macos-aarch64, windows-x86_64
- [ ] 12.2.2 Set up GitHub Actions CI/CD pipeline (build, test, lint, release)
- [ ] 12.2.3 Configure release profile for minimal binary size (LTO, strip, opt-level=3)
- [ ] 12.2.4 Create Dockerfile for containerized shared deployment mode
- [ ] 12.2.5 Verify binary size < 50MB compressed for all targets
- [ ] 12.2.6 Implement reproducible builds (lock dependencies, pinned toolchain)

### 12.3 Documentation and community
- [ ] 12.3.1 Create README.md with project overview, screenshots, quick start guide
- [ ] 12.3.2 Create CONTRIBUTING.md with development setup, code standards, PR process
- [ ] 12.3.3 Add Apache 2.0 LICENSE file
- [ ] 12.3.4 Create architecture documentation (ADRs for key decisions)
- [ ] 12.3.5 Set up public issue tracker with bug/feature request templates
- [ ] 12.3.6 Create SECURITY.md with vulnerability reporting process

### 12.4 Phase 12 Test Suite: Final Integration and Distribution Validation
- [ ]* 12.4.1 Write unit tests for theming and UI polish
  - Test theme toggle between dark/light modes
  - Test system preference detection and auto-switch
  - Test keyboard shortcut registration and handling
  - Test responsive layout breakpoints
  - Test loading states and skeleton screen rendering
  - _Requirements: 7.1_

- [ ]* 12.4.2 Write integration tests for build and distribution
  - Test cross-compilation succeeds for all 5 target platforms
  - Test binary size < 50MB compressed for all targets
  - Test Docker image builds and runs correctly
  - Test CI/CD pipeline produces valid release artifacts
  - Test reproducible builds produce identical binaries
  - _Requirements: 7.1, 7.5_

- [ ]* 12.4.3 Full end-to-end integration test suite
  - Test complete user flow: startup → connect → topology → logs → metrics → traces
  - Test multi-cluster switching with all views active
  - Test TLS mode with OIDC authentication end-to-end
  - Test theme persistence across page reloads
  - Test keyboard navigation through all major views
  - _Requirements: All_

- [ ]* 12.4.4 Stress test: full system under production-like load
  - Simulate production deployment: 5 clusters, 500 pods each, 100 concurrent users
  - Measure end-to-end latency from cluster event to UI update at scale
  - Verify binary memory usage under sustained full-feature load (target < 512MB)
  - Test 24-hour soak: continuous operation with all features active
  - Benchmark binary cold-start to fully-operational time
  - Verify no goroutine/task leaks after 1000 WebSocket connect/disconnect cycles
  - _Requirements: 7.1, 7.5_

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "name": "Wave 1 - Foundation",
      "tasks": ["1.1", "1.2"],
      "description": "Project scaffolding for backend and frontend"
    },
    {
      "id": 1,
      "name": "Wave 2 - Core Infrastructure",
      "tasks": ["1.3", "1.4", "2.1", "2.2", "2.3", "3.1", "3.2", "3.3"],
      "description": "Auth, security, cluster connection, resource graph, and Phase 1 tests. Phase 2 and 3 run in parallel after Phase 1."
    },
    {
      "id": 2,
      "name": "Wave 3 - Core Infrastructure Tests",
      "tasks": ["2.4", "3.4"],
      "description": "Test suites for authentication/security and cluster connection/resource graph."
    },
    {
      "id": 3,
      "name": "Wave 4 - Real-Time Communication",
      "tasks": ["4.1", "4.2"],
      "description": "WebSocket server and client. Requires auth (Phase 2) and cluster connection (Phase 3)."
    },
    {
      "id": 4,
      "name": "Wave 5 - Real-Time Communication Tests",
      "tasks": ["4.3"],
      "description": "WebSocket test suite including concurrent client stress tests."
    },
    {
      "id": 5,
      "name": "Wave 6 - Feature Views",
      "tasks": ["5.1", "5.2", "5.3", "6.1", "6.2", "6.3", "7.1", "7.2", "8.1", "8.2"],
      "description": "Topology, logs, metrics, and traces. All can proceed in parallel after WebSocket layer."
    },
    {
      "id": 6,
      "name": "Wave 7 - Feature View Tests",
      "tasks": ["5.4", "6.4", "7.3", "8.3"],
      "description": "Test suites for topology, logs, metrics, and traces including stress tests."
    },
    {
      "id": 7,
      "name": "Wave 8 - Advanced Features",
      "tasks": ["9.1", "9.2", "10.1", "10.2", "11.1", "11.2"],
      "description": "Multi-cluster, alerting, and extensibility. Requires feature views."
    },
    {
      "id": 8,
      "name": "Wave 9 - Advanced Feature Tests",
      "tasks": ["9.3", "10.3", "11.3"],
      "description": "Test suites for multi-cluster, alerting, and extensibility."
    },
    {
      "id": 9,
      "name": "Wave 10 - Polish and Ship",
      "tasks": ["12.1", "12.2", "12.3"],
      "description": "UI polish, build/distribution, and documentation. Final phase."
    },
    {
      "id": 10,
      "name": "Wave 11 - Final Validation",
      "tasks": ["12.4"],
      "description": "Full system integration tests, distribution validation, and production-like stress tests."
    }
  ]
}
```

## Notes

- The Rust backend uses `tokio` runtime for async I/O — all I/O operations must be async
- Frontend assets are compiled into the Rust binary via `rust-embed` — the build process must compile frontend first, then Rust
- The `kube-rs` crate provides typed Kubernetes API access and watch stream support — prefer its abstractions over raw HTTP
- WebGL/Canvas topology rendering is chosen over DOM-based (SVG) for performance at scale — this means custom hit-testing is required
- The virtual scroll implementation for logs is custom because existing libraries cannot handle 1M+ lines at 60fps
- TLS is provided by `rustls` (pure Rust) to avoid OpenSSL system dependency and simplify cross-compilation
- All credential storage is intentionally in-memory only — this is a core security design decision, not a shortcut
- The plugin system starts as compile-time (trait implementations) with optional dynamic loading in future iterations
- Tasks marked with `*` are optional test suites that can be skipped for faster MVP
- Each phase ends with a dedicated test suite covering unit tests, integration tests, stress tests, and property-based tests where applicable
- Property tests validate universal correctness properties defined in the design document
- Stress tests use realistic production-scale parameters (1000+ pods, 1M log lines, 100 concurrent clients)
- Checkpoints between test suites ensure incremental validation before proceeding to the next phase
