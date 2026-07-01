import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { TopologyView } from './components/topology/TopologyView';
import { TopologyControls } from './components/topology/TopologyControls';
import { ServiceMap } from './components/topology/ServiceMap';
import { LogViewer } from './components/logs/LogViewer';
import { MetricsDashboard } from './components/metrics/MetricsDashboard';
import { TraceExplorer, Trace } from './components/traces/TraceExplorer';
import { ClusterSelector, SearchBar, ThemeToggle, CommandPalette, ToastContainer, emitToast, HealthBar } from './components/common';
import { ShortcutsHelp } from './components/common/ShortcutsHelp';
import { PodDetailDrawer } from './components/common/PodDetailDrawer';
import { useUIStore } from './stores/ui';
import { useClusterStore, ResourceNode } from './stores/cluster';
import { useLogStore } from './stores/logs';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import {
  generateMockContexts,
  generateMockResources,
  generateMockLogs,
  generateMockTraces,
} from './lib/mock-data';

function App() {
  useTheme();
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const activeView = useUIStore((s) => s.activeView);
  const resources = useClusterStore((s) => s.resources);
  const activeContext = useClusterStore((s) => s.activeContext);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedResource, setSelectedResource] = useState<ResourceNode | null>(null);
  const prevContextRef = useRef<string | null>(null);

  // Topology filter state
  const [topoFilters, setTopoFilters] = useState<{
    namespace?: string;
    status?: string;
    search?: string;
  }>({});
  const [topoMode, setTopoMode] = useState<'resources' | 'services'>('resources');

  // Load data for a cluster
  const loadClusterData = useCallback((clusterName: string) => {
    const clusterStore = useClusterStore.getState();
    const logStore = useLogStore.getState();

    // Clear previous data
    clusterStore.clearResources();
    logStore.clear();

    clusterStore.setConnectionStatus('connecting');

    requestAnimationFrame(() => {
      clusterStore.setConnectionStatus('connected');

      // Load resources — tagged with correct cluster name
      const mockResources = generateMockResources();
      for (const r of mockResources) {
        r.clusterId = clusterName;
        clusterStore.upsertResource(r);
      }

      // Load logs
      logStore.appendLines(generateMockLogs(500));

      // Load traces (deterministic per cluster via seed)
      setTraces(generateMockTraces());
    });
  }, []);

  // Initial load
  useEffect(() => {
    const clusterStore = useClusterStore.getState();
    clusterStore.setContexts(generateMockContexts());
    clusterStore.setActiveContext('prod-us-east-1');
    loadClusterData('prod-us-east-1');
    prevContextRef.current = 'prod-us-east-1';

    // Live log streaming
    const logInterval = setInterval(() => {
      useLogStore.getState().appendLines(generateMockLogs(2));
    }, 2500);

    // Toasts — low frequency
    let toastIdx = 0;
    const toastEvents = [
      { severity: 'critical' as const, title: 'Pod CrashLoopBackOff', message: 'payment-service-a7x2k restarted 12 times', resource: 'production/payment-service-a7x2k' },
      { severity: 'warning' as const, title: 'High Memory', message: 'Node ip-10-0-2-102 at 89% memory utilization', resource: 'ip-10-0-2-102.ec2.internal' },
      { severity: 'info' as const, title: 'Deployment Scaled', message: 'api-gateway scaled from 2 to 4 replicas', resource: 'production/api-gateway' },
    ];
    const toastInterval = setInterval(() => {
      emitToast(toastEvents[toastIdx % toastEvents.length]);
      toastIdx++;
    }, 30000);

    return () => { clearInterval(logInterval); clearInterval(toastInterval); };
  }, [loadClusterData]);

  // React to cluster switches ONLY (not other state changes)
  useEffect(() => {
    if (activeContext && activeContext !== prevContextRef.current) {
      prevContextRef.current = activeContext;
      loadClusterData(activeContext);
    }
  }, [activeContext, loadClusterData]);

  // Health bar click → filter topology
  const handleHealthClick = useCallback((status: string) => {
    setTopoFilters((prev) => prev.status === status ? {} : { status });
  }, []);

  // Search bar → navigate to resource
  const handleSearchResultClick = useCallback((resource: ResourceNode) => {
    setSelectedResource(resource);
  }, []);

  // Compute health summary
  const healthSummary = computeHealthSummary(resources);

  // Get namespaces
  const namespaces = Array.from(
    new Set(
      Array.from(resources.values())
        .map((r) => r.namespace)
        .filter(Boolean) as string[]
    )
  );

  return (
    <div className="app-shell">
      <CommandPalette onResultClick={handleSearchResultClick} />
      <ToastContainer />
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
      {selectedResource && (
        <PodDetailDrawer resource={selectedResource} onClose={() => setSelectedResource(null)} />
      )}
      <Sidebar />
      <main className="main-content">
        <header className="main-header">
          <ClusterSelector />
          <SearchBar onResultClick={handleSearchResultClick} />
          <ThemeToggle />
        </header>
        <div className="view-container">
          {activeView === 'topology' && (
            <>
              <div className="topology-mode-toggle">
                <button
                  className={`topology-mode-btn ${topoMode === 'resources' ? 'topology-mode-btn--active' : ''}`}
                  onClick={() => setTopoMode('resources')}
                >
                  Resources
                </button>
                <button
                  className={`topology-mode-btn ${topoMode === 'services' ? 'topology-mode-btn--active' : ''}`}
                  onClick={() => setTopoMode('services')}
                >
                  Service Map
                </button>
                <HealthBar
                  healthy={healthSummary.healthy}
                  warning={healthSummary.warning}
                  critical={healthSummary.critical}
                  unknown={healthSummary.unknown}
                  onClick={handleHealthClick}
                />
              </div>
              {topoMode === 'resources' ? (
                <>
                  <TopologyControls
                    namespaces={namespaces}
                    onFilterChange={setTopoFilters}
                  />
                  <TopologyView filters={topoFilters} onNodeClick={setSelectedResource} />
                </>
              ) : (
                <ServiceMap clusterId={activeContext || 'default'} />
              )}
            </>
          )}
          {activeView === 'logs' && <LogViewer />}
          {activeView === 'metrics' && <MetricsDashboard resourceUid={activeContext || 'overview'} />}
          {activeView === 'traces' && <TraceExplorer traces={traces} />}
        </div>
      </main>
      <StatusBar />
    </div>
  );
}

function computeHealthSummary(resources: Map<string, any>) {
  const summary = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
  for (const r of resources.values()) {
    const state = r.status?.state || 'unknown';
    if (state in summary) {
      summary[state as keyof typeof summary]++;
    }
  }
  return summary;
}

export default App;
