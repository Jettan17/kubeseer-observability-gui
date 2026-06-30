# Iteration Log

Tracks post-implementation refinements, bug fixes, and UX improvements made after the initial 12-phase build.

## Completed Iterations

### Iteration 1: Verification & Warning Cleanup
**Date:** 2026-06-30
**Trigger:** Build verification after Phase 12 completion
**Changes:**
- Moved modules from `main.rs` to `lib.rs` for integration test access
- Suppressed dead_code warnings (expected during phased development — modules exist but aren't fully wired)
- Removed unused imports in websocket.rs, kubeconfig.rs
- Added integration test suites for Phases 1-4

**Outcome:** 0 compiler warnings, 79 backend tests pass

### Iteration 2: Wire Up Real Components
**Date:** 2026-06-30
**Trigger:** UI showed placeholder text instead of actual components
**Root Cause:** `App.tsx` was created in Phase 1 with placeholders and never updated when components were built in Phases 5-8
**Changes:**
- Replaced placeholder components with actual TopologyView, LogViewer, MetricsDashboard, TraceExplorer
- Added main header bar (ClusterSelector, SearchBar, HealthBar)
- Wired useTheme hook

**Outcome:** 100 modules bundled (was 48), all views render

### Iteration 3: Premium UI Redesign
**Date:** 2026-06-30
**Trigger:** User feedback "UI looks atrocious"
**Changes:**
- Complete CSS overhaul: glassmorphic dark theme, gradient accents, refined typography
- Design token system (radius, shadows, transitions)
- Polished components: sidebar indicator bar, status badges, health pills
- Log viewer: severity border indicators, monospace font
- Metrics cards: hover border accent
- Trace waterfall: proportional colored bars
- Mock data provider: 6 microservices, realistic logs, metrics, traces

**Outcome:** 20KB CSS (was 4.7KB), visually premium design

### Iteration 4: Topology Fixes
**Date:** 2026-06-30
**Trigger:** Cursor misaligned, nodes not colored, no visual distinction between kinds
**Root Cause:** 
- Hit-testing didn't account for devicePixelRatio
- Canvas `fillStyle` doesn't support CSS `var()` — was rendering all nodes as black
- All nodes drawn as circles with no kind differentiation
**Changes:**
- DPR-aware coordinate transform in hit-testing
- Concrete hex colors resolved from computed styles
- Different shapes per resource kind (circle/hexagon/diamond/square)
- Status coloring for pods, kind coloring for others
- Node labels (kind letter + name)
- Glow effect on hover/critical
- Added drag-to-pan (mousedown/move/up)
- Legend overlay

**Outcome:** Topology is now visually legible and interactive

### Iteration 5: Trace & Metrics Fixes
**Date:** 2026-06-30
**Trigger:** Traces "loading forever", metrics invisible (black on grey), close button ugly
**Root Cause:**
- WaterfallView received empty spans array — no mock span generator
- Canvas charts used `var()` strings directly — doesn't work in canvas API
- Close button had default white background
**Changes:**
- Added `generateMockSpans()` that creates spans on trace selection
- Chart colors resolved via `getComputedStyle()` to actual hex values
- Grid lines + X-axis time labels for readability
- Distinct color per metric (blue, teal, gold, red)
- Close button restyled with transparent bg + hover-to-red

**Outcome:** All views functional with visible, readable data

### Iteration 6: Dropdown Styling
**Date:** 2026-06-30
**Trigger:** Dropdowns have no style, white line, no chevron
**Changes:**
- Custom select styling: rounded borders, surface background, SVG chevron
- Focus glow ring, hover accent border
- Separated input and select CSS (were incorrectly merged)
- Dark theme option backgrounds

**Outcome:** Dropdowns match design system

### Iteration 7: Cluster Switch & Log Performance
**Date:** 2026-06-30
**Trigger:** Metrics don't change on cluster switch, logs have delay
**Changes:**
- App.tsx now listens to `activeContext` changes and regenerates all data
- Clear → connect → reload flow on cluster switch
- LogViewer: ResizeObserver instead of per-render measurement, will-change GPU hint, memoized filter

**Outcome:** Instant cluster switching, no log mount delay

### Iteration 8: Deterministic Metrics Data
**Date:** 2026-06-30
**Trigger:** Graph shapes differ on each cluster/window switch (data re-randomized)
**Root Cause:** `generatePointsForWindow()` used `Math.random()` on every call
**Changes:**
- Introduced seeded PRNG (mulberry32) keyed by cluster+metric name
- Full 7-day dataset generated once per cluster and cached
- Time window selector slices into stable pre-generated data
- Downsampling to ~120 points for display performance

**Outcome:** Switching cluster A → B → A shows identical graph. Time windows show consistent subsets.

## Verification Summary

| Component | Backend Tests | Frontend Tests | Build |
|-----------|:---:|:---:|:---:|
| Config & CLI | 3 ✅ | — | ✅ |
| Auth (kubeconfig, sessions) | 19 ✅ | — | ✅ |
| Resource Graph | 16 ✅ | — | ✅ |
| WebSocket Protocol | 19 ✅ | — | ✅ |
| REST API | 2 ✅ | — | ✅ |
| Topology (layout, filter) | — | 12 ✅ | ✅ |
| Log Viewer (store, virtual scroll) | — | 10 ✅ | ✅ |
| Metrics (store, chart data) | — | 9 ✅ | ✅ |
| Traces (filtering, spans) | — | 10 ✅ | ✅ |
| Multi-cluster (store, search) | — | 13 ✅ | ✅ |
| Alerting (health, notifications) | — | 10 ✅ | ✅ |
| Export (logs, metrics, JSON patch) | — | 14 ✅ | ✅ |
| Integration (cross-store flows) | 4 ✅ | 6 ✅ | ✅ |
| **Total** | **79** | **84** | ✅ |

All 163 tests pass. 0 compiler warnings. Server verified serving full frontend at localhost:9090.
