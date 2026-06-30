import { useState } from 'react';
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
import { useTheme } from './hooks/useTheme';

function App() {
  useTheme();
  const activeView = useUIStore((s) => s.activeView);
  const resources = useClusterStore((s) => s.resources);

  // Topology filter state
  const [topoFilters, setTopoFilters] = useState<{
    namespace?: string;
    status?: string;
    search?: string;
  }>({});

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

  // Placeholder traces (will come from backend in future)
  const traces: Trace[] = [];

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
          {activeView === 'metrics' && <MetricsDashboard />}
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
