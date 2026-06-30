import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { TopologyView } from './components/topology/TopologyView';
import { TopologyControls } from './components/topology/TopologyControls';
import { LogViewer } from './components/logs/LogViewer';
import { MetricsDashboard } from './components/metrics/MetricsDashboard';
import { TraceExplorer, Trace } from './components/traces/TraceExplorer';
import { ClusterSelector, SearchBar, HealthBar } from './components/common';
import { useUIStore } from './stores/ui';
import { useClusterStore } from './stores/cluster';
import { useLogStore } from './stores/logs';
import { useMetricsStore } from './stores/metrics';
import { useTheme } from './hooks/useTheme';
import {
  generateMockContexts,
  generateMockResources,
  generateMockLogs,
  generateMockMetrics,
  generateMockTraces,
} from './lib/mock-data';

function App() {
  useTheme();
  const activeView = useUIStore((s) => s.activeView);
  const resources = useClusterStore((s) => s.resources);
  const activeContext = useClusterStore((s) => s.activeContext);
  const [traces, setTraces] = useState<Trace[]>([]);

  // Topology filter state
  const [topoFilters, setTopoFilters] = useState<{
    namespace?: string;
    status?: string;
    search?: string;
  }>({});

  // Load initial cluster data
  const loadClusterData = useCallback((clusterName: string) => {
    const clusterStore = useClusterStore.getState();
    const logStore = useLogStore.getState();
    const metricsStore = useMetricsStore.getState();

    // Clear previous data
    clusterStore.clearResources();
    logStore.clear();
    metricsStore.clearSeries();

    // Simulate brief connection
    clusterStore.setConnectionStatus('connecting');

    // Load new data immediately (Rust backend would be this fast)
    requestAnimationFrame(() => {
      clusterStore.setConnectionStatus('connected');

      // Load resources for this cluster
      const mockResources = generateMockResources();
      // Tag resources with the active cluster
      for (const r of mockResources) {
        r.clusterId = clusterName;
        clusterStore.upsertResource(r);
      }

      // Load logs (pre-generated, instant)
      logStore.appendLines(generateMockLogs(500));

      // Load metrics
      metricsStore.setSeries(clusterName, generateMockMetrics());

      // Load traces
      setTraces(generateMockTraces());
    });
  }, []);

  // Initial load
  useEffect(() => {
    const clusterStore = useClusterStore.getState();
    clusterStore.setContexts(generateMockContexts());
    clusterStore.setActiveContext('prod-us-east-1');
    loadClusterData('prod-us-east-1');

    // Simulate live log streaming
    const logInterval = setInterval(() => {
      const logStore = useLogStore.getState();
      logStore.appendLines(generateMockLogs(2));
    }, 2500);

    return () => clearInterval(logInterval);
  }, [loadClusterData]);

  // React to cluster switches
  useEffect(() => {
    if (activeContext) {
      loadClusterData(activeContext);
    }
  }, [activeContext, loadClusterData]);

  // Compute health summary from resources
  const healthSummary = computeHealthSummary(resources);

  // Get namespaces for filter dropdown
  const namespaces = Array.from(
    new Set(
      Array.from(resources.values())
        .map((r) => r.namespace)
        .filter(Boolean) as string[]
    )
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <header className="main-header">
          <ClusterSelector />
          <SearchBar />
          <HealthBar
            healthy={healthSummary.healthy}
            warning={healthSummary.warning}
            critical={healthSummary.critical}
            unknown={healthSummary.unknown}
            onClick={(status) => setTopoFilters({ status })}
          />
        </header>
        <div className="view-container">
          {activeView === 'topology' && (
            <>
              <TopologyControls
                namespaces={namespaces}
                onFilterChange={setTopoFilters}
              />
              <TopologyView filters={topoFilters} />
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
