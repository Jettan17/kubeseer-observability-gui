import { useUIStore, ViewType } from '../../stores/ui';

const navItems: { id: ViewType; label: string; icon: string; shortcut: string }[] = [
  { id: 'topology', label: 'Topology', icon: '◎', shortcut: '1' },
  { id: 'logs', label: 'Logs', icon: '☰', shortcut: '2' },
  { id: 'metrics', label: 'Metrics', icon: '▤', shortcut: '3' },
  { id: 'traces', label: 'Traces', icon: '⇢', shortcut: '4' },
];

export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__header">
        <button
          className="sidebar__toggle"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
        {!collapsed && <span className="sidebar__title">KubeSeer</span>}
      </div>
      <nav className="sidebar__nav" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar__item ${activeView === item.id ? 'sidebar__item--active' : ''}`}
            onClick={() => setActiveView(item.id)}
            aria-current={activeView === item.id ? 'page' : undefined}
            title={`${item.label} (${item.shortcut})`}
          >
            <span className="sidebar__icon">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="sidebar__label">{item.label}</span>
                <kbd className="sidebar__shortcut">{item.shortcut}</kbd>
              </>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        <button
          className="sidebar__footer-btn"
          onClick={() => {
            // Dispatch keyboard event to trigger ? shortcut
            window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
          }}
          title="Keyboard shortcuts (?)"
        >
          <span className="sidebar__icon">⌨</span>
          {!collapsed && <span className="sidebar__label">Shortcuts</span>}
        </button>
        <button
          className="sidebar__footer-btn"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
          }}
          title="Search resources (/)"
        >
          <span className="sidebar__icon">🔍</span>
          {!collapsed && <span className="sidebar__label">Search</span>}
        </button>
      </div>
    </aside>
  );
}
