import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUIStore } from '../../stores/ui';
import { useClusterStore } from '../../stores/cluster';

interface CommandItem {
  id: string;
  category: 'recent' | 'navigate' | 'namespace' | 'resource';
  label: string;
  description?: string;
  icon?: string;
  action: () => void;
}

// LRU recent commands
const recentCommandIds: string[] = [];
const MAX_RECENT = 5;

function addToRecent(id: string) {
  const idx = recentCommandIds.indexOf(id);
  if (idx !== -1) recentCommandIds.splice(idx, 1);
  recentCommandIds.unshift(id);
  if (recentCommandIds.length > MAX_RECENT) recentCommandIds.pop();
}

// Event-based filter dispatch (consumed by App.tsx)
export function dispatchTopoFilter(filter: { namespace?: string; search?: string }) {
  window.dispatchEvent(new CustomEvent('kubeseer:topo-filter', { detail: filter }));
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const resources = useClusterStore((s) => s.resources);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build items: namespaces first, then navigation, then resources
  const allItems = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Namespaces (deduplicated)
    const namespaces = new Set<string>();
    for (const r of resources.values()) {
      if (r.namespace) namespaces.add(r.namespace);
    }
    for (const ns of namespaces) {
      items.push({
        id: `ns-${ns}`,
        category: 'namespace',
        label: ns,
        description: 'Filter topology to namespace',
        icon: '📁',
        action: () => {
          dispatchTopoFilter({ namespace: ns });
          setActiveView('topology');
        },
      });
    }

    // Navigation
    items.push(
      { id: 'nav-topology', category: 'navigate', label: 'Go to Topology', icon: '◎', action: () => setActiveView('topology') },
      { id: 'nav-logs', category: 'navigate', label: 'Go to Logs', icon: '☰', action: () => setActiveView('logs') },
      { id: 'nav-metrics', category: 'navigate', label: 'Go to Metrics', icon: '▤', action: () => setActiveView('metrics') },
      { id: 'nav-traces', category: 'navigate', label: 'Go to Traces', icon: '⇢', action: () => setActiveView('traces') },
    );

    // Resources (top 30)
    const resourceList = Array.from(resources.values()).slice(0, 30);
    for (const r of resourceList) {
      items.push({
        id: `resource-${r.uid}`,
        category: 'resource',
        label: r.name,
        description: `${r.kind} in ${r.namespace || 'cluster'}`,
        icon: r.kind === 'Pod' ? 'P' : r.kind === 'Deployment' ? 'D' : r.kind === 'Service' ? 'S' : r.kind === 'Node' ? 'N' : 'R',
        action: () => {
          dispatchTopoFilter({ search: r.name });
          setActiveView('topology');
        },
      });
    }

    return items;
  }, [resources, setActiveView]);

  // Filter and sort: recent first
  const filteredItems = useMemo(() => {
    if (!query) {
      const recent = recentCommandIds
        .map((id) => allItems.find((item) => item.id === id))
        .filter(Boolean)
        .map((item) => ({ ...item!, category: 'recent' as const }));
      const rest = allItems.filter((item) => !recentCommandIds.includes(item.id));
      return [...recent, ...rest].slice(0, 12);
    }
    const lower = query.toLowerCase();
    return allItems
      .filter((item) => item.label.toLowerCase().includes(lower) || item.description?.toLowerCase().includes(lower))
      .slice(0, 12);
  }, [allItems, query]);

  // Scroll selected into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const el = container.children[selectedIndex] as HTMLElement;
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) { addToRecent(item.id); item.action(); setIsOpen(false); }
      }
    },
    [filteredItems, selectedIndex]
  );

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette__input-wrapper">
          <span className="command-palette__search-icon">⌘</span>
          <input
            ref={inputRef}
            className="command-palette__input"
            type="text"
            placeholder="Search namespaces, resources, actions..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            aria-label="Command palette"
          />
          <kbd className="command-palette__kbd">ESC</kbd>
        </div>
        <div className="command-palette__results" role="listbox" ref={resultsRef}>
          {filteredItems.length === 0 && (
            <div className="command-palette__empty">No results found</div>
          )}
          {filteredItems.map((item, i) => (
            <button
              key={item.id}
              className={`command-palette__item ${i === selectedIndex ? 'command-palette__item--selected' : ''}`}
              onClick={() => { addToRecent(item.id); item.action(); setIsOpen(false); }}
              role="option"
              aria-selected={i === selectedIndex}
            >
              <span className="command-palette__item-icon">{item.icon}</span>
              <div className="command-palette__item-content">
                <span className="command-palette__item-label">{item.label}</span>
                {item.description && (
                  <span className="command-palette__item-desc">{item.description}</span>
                )}
              </div>
              <span className="command-palette__item-category">
                {item.category === 'recent' ? '⏱ recent' : item.category}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
