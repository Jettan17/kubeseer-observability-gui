import { useClusterStore } from '../../stores/cluster';
import { Dropdown } from './Dropdown';

export function ClusterSelector() {
  const contexts = useClusterStore((s) => s.contexts);
  const activeContext = useClusterStore((s) => s.activeContext);
  const setActiveContext = useClusterStore((s) => s.setActiveContext);

  const options = contexts.map((ctx) => ({
    value: ctx.name,
    label: ctx.name,
    icon: ctx.connected ? '●' : '○',
  }));

  return (
    <Dropdown
      options={options}
      value={activeContext || ''}
      onChange={setActiveContext}
      placeholder="Select cluster..."
      className="cluster-selector"
      aria-label="Select cluster context"
    />
  );
}
