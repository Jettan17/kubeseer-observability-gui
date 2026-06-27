import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { useUIStore } from './stores/ui';

function App() {
  const activeView = useUIStore((s) => s.activeView);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="view-container">
          {activeView === 'topology' && <TopologyPlaceholder />}
          {activeView === 'logs' && <LogsPlaceholder />}
          {activeView === 'metrics' && <MetricsPlaceholder />}
          {activeView === 'traces' && <TracesPlaceholder />}
        </div>
      </main>
      <StatusBar />
    </div>
  );
}

function TopologyPlaceholder() {
  return <div className="view-placeholder">Topology View — coming in Phase 5</div>;
}

function LogsPlaceholder() {
  return <div className="view-placeholder">Log Viewer — coming in Phase 6</div>;
}

function MetricsPlaceholder() {
  return <div className="view-placeholder">Metrics Dashboard — coming in Phase 7</div>;
}

function TracesPlaceholder() {
  return <div className="view-placeholder">Trace Explorer — coming in Phase 8</div>;
}

export default App;
