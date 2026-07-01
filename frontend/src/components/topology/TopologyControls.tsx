import { useState } from 'react';
import { Dropdown } from '../common/Dropdown';

interface TopologyControlsProps {
  namespaces: string[];
  onFilterChange: (filters: {
    namespace?: string;
    status?: string;
    search?: string;
  }) => void;
}

export function TopologyControls({ namespaces, onFilterChange }: TopologyControlsProps) {
  const [namespace, setNamespace] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const handleChange = (ns: string = namespace, st: string = status, sr: string = search) => {
    onFilterChange({
      namespace: ns || undefined,
      status: st || undefined,
      search: sr || undefined,
    });
  };

  const nsOptions = [
    { value: '', label: 'All namespaces' },
    ...namespaces.map((ns) => ({ value: ns, label: ns })),
  ];

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'healthy', label: 'Healthy', icon: '🟢' },
    { value: 'warning', label: 'Warning', icon: '🟡' },
    { value: 'critical', label: 'Critical', icon: '🔴' },
  ];

  return (
    <div className="topology-controls" role="toolbar" aria-label="Topology filters">
      <Dropdown
        options={nsOptions}
        value={namespace}
        onChange={(v) => { setNamespace(v); handleChange(v, status, search); }}
        placeholder="All namespaces"
        aria-label="Filter by namespace"
      />
      <Dropdown
        options={statusOptions}
        value={status}
        onChange={(v) => { setStatus(v); handleChange(namespace, v, search); }}
        placeholder="All statuses"
        aria-label="Filter by status"
      />
      <input
        type="search"
        placeholder="Search resources..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); handleChange(namespace, status, e.target.value); }}
        aria-label="Search resources"
      />
    </div>
  );
}
