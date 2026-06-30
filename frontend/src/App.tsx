import { useState, useEffect } from 'react';
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
  const [traces, setTraces] = useState<Trace[]>([]);

  // Topology filter state
  const [topoFilters, setTopoFilters] = useState<{
    namespace?: string;
    status?: string;
    search?: string;
  }>({});

  // Load mock data on mount
  useEffect(() => {
    const clusterStore = useClusterStore.getState();
    const logStore = useLogStore.getState();
    const metricsStore = useMetricsStore.getState();

    // Set up cluster
    clusterStore.setContexts(generateMockContexts());
    clusterStore.setActiveContext('prod-us-east-1');
    clusterStore.setConnectionStatus('connected');

    // Load resources
    const mockResources = generateMockResources();
    for (const r of mockResources) {
      clusterStore.upsertResource(r);
    }

    // Load logs
    logStore.appendLines(generateMockLogs(500));

    // Load metrics
    metricsStore.setSeries('overview', generateMockMetrics());

    // Load traces
    setTraces(generateMockTraces());

    // Simulate live log streaming
    const logInterval = setInterval(() => {
      const newLogs = generateMockLogs(3);
      logStore.appendLines(newLogs);
    }, 2000);

    return () => clearInterval(logInterval);
  }, []);

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
          {activeView === 'metrics' && <MetricsDashboard resourceUid="overview" />}
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
