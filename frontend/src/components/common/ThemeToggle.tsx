import { useUIStore } from '../../stores/ui';

/**
 * Animated sun/moon theme toggle button.
 */
export function ThemeToggle() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggle = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  return (
    <button
      className={`theme-toggle ${isDark ? 'theme-toggle--dark' : 'theme-toggle--light'}`}
      onClick={toggle}
      aria-label={`Current theme: ${theme}. Click to cycle.`}
      title={`Theme: ${theme}`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 11a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 12zm7-4a.5.5 0 01-.5.5h-1a.5.5 0 010-1h1a.5.5 0 01.5.5zM3 8a.5.5 0 01-.5.5h-1a.5.5 0 010-1h1A.5.5 0 013 8zm9.95-3.54a.5.5 0 010 .7l-.71.71a.5.5 0 11-.7-.7l.7-.71a.5.5 0 01.71 0zM5.46 11.25a.5.5 0 010 .7l-.7.71a.5.5 0 11-.71-.7l.7-.71a.5.5 0 01.71 0zm7.08 0a.5.5 0 01-.7 0l-.71-.7a.5.5 0 01.7-.71l.71.7a.5.5 0 010 .71zM5.46 4.75a.5.5 0 01-.7 0l-.71-.7a.5.5 0 11.7-.71l.71.7a.5.5 0 010 .71zM8 5a3 3 0 100 6 3 3 0 000-6z" fill="currentColor"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 1a.5.5 0 00-.482.631A5.5 5.5 0 009.869 10.48.5.5 0 0010.5 10 6.5 6.5 0 016 1z" fill="currentColor"/>
          </svg>
        )}
      </span>
    </button>
  );
}
