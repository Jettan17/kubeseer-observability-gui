import { useState, useCallback } from 'react';
import { useClusterStore, ResourceNode } from '../../stores/cluster';

interface SearchResult {
  resource: ResourceNode;
  matchField: string;
}

interface SearchBarProps {
  onResultClick?: (resource: ResourceNode) => void;
}

export function SearchBar({ onResultClick }: SearchBarProps) {
  const resources = useClusterStore((s) => s.resources);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      if (q.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      const lower = q.toLowerCase();
      const matched: SearchResult[] = [];

      for (const resource of resources.values()) {
        if (matched.length >= 20) break;

        if (resource.name.toLowerCase().includes(lower)) {
          matched.push({ resource, matchField: 'name' });
        } else if (resource.namespace?.toLowerCase().includes(lower)) {
          matched.push({ resource, matchField: 'namespace' });
        } else if (
          Object.keys(resource.labels).some(
            (k) => k.toLowerCase().includes(lower) || resource.labels[k].toLowerCase().includes(lower)
          )
        ) {
          matched.push({ resource, matchField: 'label' });
        }
      }

      setResults(matched);
      setIsOpen(matched.length > 0);
    },
    [resources]
  );

  const handleSelect = (resource: ResourceNode) => {
    setIsOpen(false);
    setQuery('');
    onResultClick?.(resource);
  };

  return (
    <div className="search-bar" role="search">
      <input
        type="search"
        className="search-bar__input"
        placeholder="Search resources across clusters..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        aria-label="Search resources"
        aria-expanded={isOpen}
        aria-controls="search-results"
      />
      {isOpen && (
        <ul className="search-bar__results" id="search-results" role="listbox">
          {results.map((result) => (
            <li key={result.resource.uid} role="option">
              <button
                className="search-bar__result-item"
                onClick={() => handleSelect(result.resource)}
              >
                <span className="search-bar__kind">{result.resource.kind}</span>
                <span className="search-bar__name">{result.resource.name}</span>
                {result.resource.namespace && (
                  <span className="search-bar__ns">{result.resource.namespace}</span>
                )}
                <span className="search-bar__cluster">{result.resource.clusterId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
