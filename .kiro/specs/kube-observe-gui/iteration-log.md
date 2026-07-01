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

### Iteration 9: Phase 13 Polish Features
**Date:** 2026-07-01
**Changes:**
- 13.3: Theme toggle (dark/light/system) with animated icon
- 13.1: Command palette (⌘K) with fuzzy search, keyboard navigation, LRU recent
- 13.4: Toast notifications (30s interval, severity colors, auto-dismiss)
- 13.8: Keyboard shortcuts (1-4 views, /, ?, Esc) + help overlay
- 13.2: Pod detail drawer (slide-out panel, status/metrics/labels/actions)
- 13.6: Golden signals dashboard (latency/traffic/errors/saturation + sparklines)
- 13.7: Log-to-trace correlation (regex trace ID detection, clickable links)
- 13.5: Namespace swimlanes (colored background regions in topology)
- 13.8: Deployment timeline (vertical event timeline below metrics)
- 13.9: Service dependency map (force-directed graph with traffic flow arrows)

**Outcome:** All 10 polish features implemented, 84 frontend tests pass

### Iteration 10: UX Feedback Round 1
**Date:** 2026-07-01
**Trigger:** User testing revealed cursor misalignment, chart colors invisible, traces blank
**Changes:**
- Fixed topology zoom to use cursor as anchor point
- Fixed tooltip not disappearing when drawer opens
- Added pan/zoom to service map canvas
- Golden signals now regenerate per time window (different seeds)
- Traces auto-select first trace on navigation (no blank panel)
- Toasts reduced to 30s intervals (was 8s, too noisy)

### Iteration 11: UX Feedback Round 2
**Date:** 2026-07-01
**Trigger:** Health indicators confusing on non-topology views, search z-index bug
**Changes:**
- Moved health bar from global header into topology sub-header
- Health click now toggles filter (click again to clear)
- Search dropdown z-index fixed to 1000 (was hidden behind content)
- All mock clusters show connected status
- Sidebar shows shortcut badges and footer buttons (Shortcuts, Commands)

### Iteration 12: UX Feedback Round 3
**Date:** 2026-07-01
**Trigger:** Search not navigable by keyboard, command palette namespace selection broken
**Changes:**
- Search bar now supports arrow key navigation with scroll-into-view
- Selected result highlighted with accent background
- Command palette: removed theme settings, reordered (namespaces → navigation → resources)
- Selecting a namespace in command palette now dispatches filter and switches to topology
- Resources in command palette filter topology by name search
- Event-based filter dispatch (CustomEvent) for cross-component communication

### Remaining TODO Items

**Phase 13 remaining (stretch goals):**
- 13.10: AI Troubleshooting Assistant (8hr+ effort)
- Namespace swimlane collapse/expand (enhancement)

**Backend wiring (production readiness):**
- Wire ClusterManager to REST endpoints
- Wire ResourceWatcher to WebSocket broadcast
- Wire pod log streaming to WebSocket
- Implement Prometheus query client
- Implement TLS listener bind
- Implement OIDC authentication flow
- Replace mock data sources with REST/WebSocket calls
- Build automation (frontend → Rust embed pipeline)

**Known minor issues:**
- Log-to-trace: trace IDs in logs don't map to specific mock traces (would work with real backend)
- Service map: no hover tooltips on nodes (would show detailed stats)
- Deployment timeline: static mock data (would come from K8s Deployment watch events)

### Iteration 13: Command Palette → Focused Resource Search
**Date:** 2026-07-01
**Trigger:** User feedback — command palette felt useless with shortcuts already handling navigation
**Root Cause:** The command palette tried to be a swiss army knife (navigate, theme, resources) when individual tools already existed for each
**Changes:**
- Removed command palette's navigation/theme actions entirely
- Replaced with focused resource search: single purpose, search pods/deploys/services/namespaces
- Shows status badge per result (healthy/warning/critical)
- Selecting a result opens pod detail drawer
- Changed hotkey from ⌘K to `/` (matches convention, simpler)
- Sidebar button updated: "⌘ Commands" → "🔍 Search"

**Outcome:** Cleaner UX, single-purpose overlay that does one thing well

### Iteration 14: Escape Key & Drawer Animation
**Date:** 2026-07-01
**Trigger:** Escape didn't close search overlay or pod drawer
**Root Cause:** 
- Search overlay: Escape was blocked by the `isInput` guard (input was focused)
- Pod drawer: No keydown listener existed
**Changes:**
- Search overlay: Escape always fires (removed input guard for that key)
- Pod drawer: Added useEffect keydown listener for Escape
- Drawer now has slide-out exit animation (reverse of entry, 180ms)
- Overlay fades out simultaneously

**Outcome:** Escape universally closes overlays, drawer exit feels polished

### Iteration 15: UI Polish Pass
**Date:** 2026-07-01
**Trigger:** Metrics layout 3+1 (ugly), emoji search icon, general tightening
**Changes:**
- Metrics grid forced to 2×2 (was auto-fit causing 3+1 on wide screens)
- Golden signals responsive: 4-col → 2-col under 900px
- Sidebar search icon: emoji 🔍 → monochrome SVG (design system consistency)
- Input border-radius unified to radius-md
- Service dependency map: KIV (kept for demo capability)

**Outcome:** Consistent visual rhythm, no layout jank

### Current State Summary

**Features implemented (Phase 13):**
1. ✅ Theme toggle (dark/light/system)
2. ✅ Resource search overlay (/ hotkey)
3. ✅ Toast notifications (30s cadence)
4. ✅ Keyboard shortcuts (1-4, /, ?, Esc) + help overlay
5. ✅ Pod detail drawer (click node → slide-out panel → view logs/metrics/traces)
6. ✅ Namespace swimlanes in topology
7. ✅ Golden signals dashboard (latency/traffic/errors/saturation)
8. ✅ Log-to-trace correlation (regex detection, clickable links)
9. ✅ Deployment timeline (below metrics charts)
10. ✅ Service dependency map (force-directed traffic graph)

**Test coverage:**
- Backend: 79 tests (Rust)
- Frontend: 84 tests (Vitest)
- Total: 163 tests, 0 failures
- 0 compiler warnings, 0 clippy issues

**Architecture:**
- Single Rust binary serves embedded React SPA
- Zustand stores are single source of truth
- Mock data generators are the only swap point for real backend
- All components read from stores, never from generators directly
- `loadClusterData()` in App.tsx is the integration point for real API calls


### Iteration 16: Topology Layout Physics Overhaul
**Date:** 2026-07-01
**Trigger:** Namespace boundaries overlapping, orphan nodes too far out, within-namespace spacing too tight
**Changes:**
- Added inter-namespace repulsion force: if two namespace centroids < 200px apart, pushes them away proportionally (strength 0.8)
- Intra-namespace clustering kept gentle (0.15)
- Hierarchy nodes (Node, Namespace kinds) pinned to header row at Y=50, evenly spaced
- 200px clear gap between header row and workload zone
- Within-namespace charge: -350 for more breathing room
- Orphan nodes: -50 charge (barely repel, since they're manually positioned)
- Collision radius: +10px per node

**Outcome:** Clean visual hierarchy: infrastructure header → clear gap → separated namespace groups with no boundary overlap

### Iteration 17: Visual Polish & Functional Additions
**Date:** 2026-07-01
**Trigger:** UI not meeting awwwards standard, missing functionality
**Changes:**
- Custom Dropdown component replacing native `<select>` (rounded items, checkmark, keyboard nav)
- Google Fonts loaded (Inter 300-700, JetBrains Mono)
- Dark glassmorphism theme: deeper blacks, backdrop-filter blur, ambient gradient background
- Topology nodes: radial gradient fills (3D sphere), reduced glow (4px/12px), curved bezier edges
- Service color changed from yellow to pink (#f472b6) for differentiation
- Status colors desaturated (green #6ccfb5, yellow #e8b84a, red #e86b73) for text contrast
- Service map: same gradient sphere style, hierarchical L-R BFS layout
- Header redesigned: troubleshoot prompt bar, account menu with role/RBAC/session
- Command palette replaced with focused resource search (/ hotkey)
- Account menu: Escape closes, toggle on click, Preferences/API Keys/Audit Log items
- Toast notifications repositioned when panels open (CSS :has())
- Pod drawer: slide-out exit animation
- Metrics: forced 2×2 grid, golden signals responsive 4→2 col
- Legend: now shows Kind + Status sections with divider

### Final Feature Count

**Phase 13 features (all complete):**
1. ✅ Theme toggle → replaced by always-dark premium theme
2. ✅ Resource search overlay (/ hotkey)
3. ✅ Toast notifications (30s, repositions for panels)
4. ✅ Keyboard shortcuts (1-4, /, T, ?, Esc) + help overlay
5. ✅ Pod detail drawer (click node → slide panel → view logs/metrics/traces)
6. ✅ Golden signals dashboard (latency/traffic/errors/saturation + sparklines)
7. ✅ Log-to-trace correlation (regex detection, clickable links)
8. ✅ Namespace swimlanes with inter-namespace repulsion
9. ✅ Deployment timeline (vertical event timeline)
10. ✅ Service dependency map (BFS hierarchical L-R layout)
11. ✅ Troubleshoot assistant (rule-based engine, 7 query patterns, chat UI)
12. ✅ Account menu (role, RBAC, session, preferences)
13. ✅ Custom dropdown component (replaces all native selects)

**Test coverage:**
- Backend: 79 tests (Rust)
- Frontend: 94 tests (Vitest)
- Total: 173 tests, 0 failures
- 0 compiler warnings

**Commits since Phase 13 start:** 25+
**Total commits on main:** 40+
