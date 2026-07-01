import { useUIStore, ViewType } from '../../stores/ui';

const navItems: { id: ViewType; label: string; icon: string }[] = [
  { id: 'topology', label: 'Topology', icon: '◎' },
  { id: 'logs', label: 'Logs', icon: '☰' },
  { id: 'metrics', label: 'Metrics', icon: '▤' },
  { id: 'traces', label: 'Traces', icon: '⇢' },
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
            title={item.label}
          >
            <span className="sidebar__icon">{item.icon}</span>
            {!collapsed && <span className="sidebar__label">{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
