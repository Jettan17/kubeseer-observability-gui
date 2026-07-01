import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsRef = useRef<HTMLUListElement>(null);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      setSelectedIndex(0);
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

  // Scroll selected into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.children[selectedIndex] as HTMLElement;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = (resource: ResourceNode) => {
    setIsOpen(false);
    setQuery('');
    onResultClick?.(resource);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(results[selectedIndex].resource);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="search-bar" role="search">
      <input
        type="search"
        className="search-bar__input"
        placeholder="Search resources (min 2 chars)..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={handleKeyDown}
        aria-label="Search resources"
        aria-expanded={isOpen}
        aria-controls="search-results"
      />
      {isOpen && (
        <ul className="search-bar__results" id="search-results" role="listbox" ref={resultsRef}>
          {results.map((result, i) => (
            <li key={result.resource.uid} role="option" aria-selected={i === selectedIndex}>
              <button
                className={`search-bar__result-item ${i === selectedIndex ? 'search-bar__result-item--selected' : ''}`}
                onClick={() => handleSelect(result.resource)}
              >
                <span className="search-bar__kind">{result.resource.kind}</span>
                <span className="search-bar__name">{result.resource.name}</span>
                {result.resource.namespace && (
                  <span className="search-bar__ns">{result.resource.namespace}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
