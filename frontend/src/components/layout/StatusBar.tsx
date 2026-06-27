import { useClusterStore } from '../../stores/cluster';

export function StatusBar() {
  const connectionStatus = useClusterStore((s) => s.connectionStatus);
  const activeContext = useClusterStore((s) => s.activeContext);

  const statusIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return <span className="status-dot status-dot--connected" title="Connected" />;
      case 'connecting':
        return <span className="status-dot status-dot--connecting" title="Connecting..." />;
      case 'error':
        return <span className="status-dot status-dot--error" title="Connection error" />;
      default:
        return <span className="status-dot status-dot--disconnected" title="Disconnected" />;
    }
  };

  return (
    <footer className="status-bar" role="status">
      <div className="status-bar__left">
        {statusIndicator()}
        <span className="status-bar__text">
          {activeContext ? `Cluster: ${activeContext}` : 'No cluster connected'}
        </span>
      </div>
      <div className="status-bar__right">
        <span className="status-bar__version">v{__APP_VERSION__}</span>
      </div>
    </footer>
  );
}

declare const __APP_VERSION__: string;
