import { useClusterStore } from '../../stores/cluster';

export function ClusterSelector() {
  const contexts = useClusterStore((s) => s.contexts);
  const activeContext = useClusterStore((s) => s.activeContext);
  const setActiveContext = useClusterStore((s) => s.setActiveContext);
  const connectionStatus = useClusterStore((s) => s.connectionStatus);

  return (
    <div className="cluster-selector" role="group" aria-label="Cluster selection">
      <select
        value={activeContext || ''}
        onChange={(e) => setActiveContext(e.target.value)}
        className="cluster-selector__dropdown"
        aria-label="Select cluster context"
        disabled={connectionStatus === 'connecting'}
      >
        <option value="" disabled>
          Select cluster...
        </option>
        {contexts.map((ctx) => (
          <option key={ctx.name} value={ctx.name}>
            {ctx.name} {ctx.connected ? '●' : '○'}
          </option>
        ))}
      </select>
      {connectionStatus === 'connecting' && (
        <span className="cluster-selector__spinner" aria-label="Connecting">⟳</span>
      )}
    </div>
  );
}
