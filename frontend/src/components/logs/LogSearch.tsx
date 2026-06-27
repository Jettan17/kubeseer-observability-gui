import { useLogStore } from '../../stores/logs';

export function LogSearch() {
  const searchQuery = useLogStore((s) => s.searchQuery);
  const setSearchQuery = useLogStore((s) => s.setSearchQuery);
  const levelFilter = useLogStore((s) => s.levelFilter);
  const toggleLevelFilter = useLogStore((s) => s.toggleLevelFilter);
  const clear = useLogStore((s) => s.clear);

  const levels = ['error', 'warn', 'info', 'debug'] as const;

  return (
    <div className="log-search" role="toolbar" aria-label="Log controls">
      <input
        type="search"
        className="log-search__input"
        placeholder="Search logs..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        aria-label="Search log messages"
      />
      <div className="log-search__levels" role="group" aria-label="Level filters">
        {levels.map((level) => (
          <button
            key={level}
            className={`log-search__level log-search__level--${level} ${
              levelFilter.has(level) ? 'log-search__level--active' : ''
            }`}
            onClick={() => toggleLevelFilter(level)}
            aria-pressed={levelFilter.has(level)}
            aria-label={`Toggle ${level} logs`}
          >
            {level.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        className="log-search__clear"
        onClick={clear}
        aria-label="Clear logs"
      >
        Clear
      </button>
    </div>
  );
}
