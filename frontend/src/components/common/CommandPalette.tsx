/**
 * Global search overlay (⌘K / Ctrl+K).
 * Same search logic as the header search bar, but presented as a
 * centered modal for focused resource discovery.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useClusterStore, ResourceNode } from '../../stores/cluster';

interface SearchResult {
  resource: ResourceNode;
  matchField: string;
}

interface CommandPaletteProps {
  onResultClick?: (resource: ResourceNode) => void;
}

export function CommandPalette({ onResultClick }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resources = useClusterStore((s) => s.resources);

  // Global shortcut: Ctrl+K / ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search resources
  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      setSelectedIndex(0);

      if (q.length < 1) {
        setResults([]);
        return;
      }

      const lower = q.toLowerCase();
      const matched: SearchResult[] = [];

      for (const resource of resources.values()) {
        if (matched.length >= 15) break;

        if (resource.name.toLowerCase().includes(lower)) {
          matched.push({ resource, matchField: 'name' });
        } else if (resource.namespace?.toLowerCase().includes(lower)) {
          matched.push({ resource, matchField: 'namespace' });
        } else if (resource.kind.toLowerCase().includes(lower)) {
          matched.push({ resource, matchField: 'kind' });
        } else if (
          Object.keys(resource.labels).some(
            (k) => k.toLowerCase().includes(lower) || resource.labels[k].toLowerCase().includes(lower)
          )
        ) {
          matched.push({ resource, matchField: 'label' });
        }
      }

      setResults(matched);
    },
    [resources]
  );

  // Scroll into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const el = container.children[selectedIndex] as HTMLElement;
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  const handleSelect = (resource: ResourceNode) => {
    setIsOpen(false);
    setQuery('');
    onResultClick?.(resource);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex].resource);
        }
      }
    },
    [results, selectedIndex]
  );

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette__input-wrapper">
          <svg className="command-palette__search-svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11.5" y1="11.5" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="command-palette__input"
            type="text"
            placeholder="Search pods, deployments, services, namespaces..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search resources"
          />
          <kbd className="command-palette__kbd">ESC</kbd>
        </div>
        {results.length > 0 && (
          <div className="command-palette__results" role="listbox" ref={resultsRef}>
            {results.map((r, i) => (
              <button
                key={r.resource.uid}
                className={`command-palette__item ${i === selectedIndex ? 'command-palette__item--selected' : ''}`}
                onClick={() => handleSelect(r.resource)}
                role="option"
                aria-selected={i === selectedIndex}
              >
                <span className="command-palette__item-icon">
                  {r.resource.kind === 'Pod' ? 'P' : r.resource.kind === 'Deployment' ? 'D' : r.resource.kind === 'Service' ? 'S' : r.resource.kind === 'Node' ? 'N' : r.resource.kind[0]}
                </span>
                <div className="command-palette__item-content">
                  <span className="command-palette__item-label">{r.resource.name}</span>
                  <span className="command-palette__item-desc">
                    {r.resource.kind} {r.resource.namespace ? `in ${r.resource.namespace}` : ''}
                  </span>
                </div>
                <span className={`command-palette__item-status command-palette__item-status--${r.resource.status.state}`}>
                  {r.resource.status.state}
                </span>
              </button>
            ))}
          </div>
        )}
        {query.length > 0 && results.length === 0 && (
          <div className="command-palette__empty">No resources match "{query}"</div>
        )}
        {query.length === 0 && (
          <div className="command-palette__hint">
            Start typing to search across all resources in the cluster
          </div>
        )}
      </div>
    </div>
  );
}
