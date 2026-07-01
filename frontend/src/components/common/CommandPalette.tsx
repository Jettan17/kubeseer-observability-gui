import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUIStore } from '../../stores/ui';
import { useClusterStore } from '../../stores/cluster';

interface CommandItem {
  id: string;
  category: 'recent' | 'navigate' | 'resource' | 'action';
  label: string;
  description?: string;
  icon?: string;
  action: () => void;
}

// LRU recent commands (persisted in memory)
const recentCommandIds: string[] = [];
const MAX_RECENT = 5;

function addToRecent(id: string) {
  const idx = recentCommandIds.indexOf(id);
  if (idx !== -1) recentCommandIds.splice(idx, 1);
  recentCommandIds.unshift(id);
  if (recentCommandIds.length > MAX_RECENT) recentCommandIds.pop();
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const setTheme = useUIStore((s) => s.setTheme);
  const resources = useClusterStore((s) => s.resources);

  // Global keyboard shortcut
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

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build command items
  const allItems = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [
      { id: 'nav-topology', category: 'navigate', label: 'Go to Topology', icon: '◎', action: () => setActiveView('topology') },
      { id: 'nav-logs', category: 'navigate', label: 'Go to Logs', icon: '☰', action: () => setActiveView('logs') },
      { id: 'nav-metrics', category: 'navigate', label: 'Go to Metrics', icon: '▤', action: () => setActiveView('metrics') },
      { id: 'nav-traces', category: 'navigate', label: 'Go to Traces', icon: '⇢', action: () => setActiveView('traces') },
      { id: 'action-dark', category: 'action', label: 'Set Dark Theme', icon: '🌙', action: () => setTheme('dark') },
      { id: 'action-light', category: 'action', label: 'Set Light Theme', icon: '☀️', action: () => setTheme('light') },
      { id: 'action-system', category: 'action', label: 'Set System Theme', icon: '💻', action: () => setTheme('system') },
    ];

    const resourceList = Array.from(resources.values()).slice(0, 50);
    for (const r of resourceList) {
      items.push({
        id: `resource-${r.uid}`,
        category: 'resource',
        label: r.name,
        description: `${r.kind} ${r.namespace ? `in ${r.namespace}` : ''}`,
        icon: r.kind === 'Pod' ? 'P' : r.kind === 'Deployment' ? 'D' : r.kind === 'Service' ? 'S' : 'R',
        action: () => setActiveView('topology'),
      });
    }

    return items;
  }, [resources, setActiveView, setTheme]);

  // Filter and sort: recent first, then matches
  const filteredItems = useMemo(() => {
    let items: CommandItem[];
    if (!query) {
      // Show recent at top, then navigation
      const recent = recentCommandIds
        .map((id) => allItems.find((item) => item.id === id))
        .filter(Boolean)
        .map((item) => ({ ...item!, category: 'recent' as const }));
      const rest = allItems.filter((item) => !recentCommandIds.includes(item.id));
      items = [...recent, ...rest].slice(0, 15);
    } else {
      const lower = query.toLowerCase();
      items = allItems
        .filter(
          (item) =>
            item.label.toLowerCase().includes(lower) ||
            item.description?.toLowerCase().includes(lower)
        )
        .slice(0, 15);
    }
    return items;
  }, [allItems, query]);

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const selected = container.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
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
        if (item) {
          addToRecent(item.id);
          item.action();
          setIsOpen(false);
        }
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
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            aria-label="Command palette search"
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
              id={item.id}
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
