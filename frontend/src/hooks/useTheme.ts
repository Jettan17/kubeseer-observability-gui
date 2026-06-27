import { useEffect } from 'react';
import { useUIStore, Theme } from '../stores/ui';

/**
 * Hook to manage theme application to the document.
 * Respects system preference when theme is set to 'system'.
 */
export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (resolvedTheme: 'dark' | 'light') => {
      root.setAttribute('data-theme', resolvedTheme);
    };

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(media.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  return { theme, setTheme };
}

export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}
