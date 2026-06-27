import { useState } from 'react';

interface TopologyControlsProps {
  namespaces: string[];
  onFilterChange: (filters: {
    namespace?: string;
    status?: string;
    search?: string;
  }) => void;
}

export function TopologyControls({ namespaces, onFilterChange }: TopologyControlsProps) {
  const [namespace, setNamespace] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const handleChange = (
    ns: string = namespace,
    st: string = status,
    sr: string = search
  ) => {
    onFilterChange({
      namespace: ns || undefined,
      status: st || undefined,
      search: sr || undefined,
    });
  };

  return (
    <div className="topology-controls" role="toolbar" aria-label="Topology filters">
      <select
        value={namespace}
        onChange={(e) => {
          setNamespace(e.target.value);
          handleChange(e.target.value, status, search);
        }}
        aria-label="Filter by namespace"
      >
        <option value="">All namespaces</option>
        {namespaces.map((ns) => (
          <option key={ns} value={ns}>
            {ns}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          handleChange(namespace, e.target.value, search);
        }}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option value="healthy">Healthy</option>
        <option value="warning">Warning</option>
        <option value="critical">Critical</option>
        <option value="unknown">Unknown</option>
      </select>

      <input
        type="search"
        placeholder="Search resources..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          handleChange(namespace, status, e.target.value);
        }}
        aria-label="Search resources"
      />
    </div>
  );
}
