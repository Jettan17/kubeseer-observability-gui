import { useEffect, useState } from 'react';
import { useUIStore } from '../stores/ui';

/**
 * Global keyboard shortcuts.
 * 
 * 1-4: Switch views
 * /: Focus search
 * ?: Show help overlay
 * Escape: Close overlays
 */
export function useKeyboardShortcuts() {
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      switch (e.key) {
        case '1':
          setActiveView('topology');
          break;
        case '2':
          setActiveView('logs');
          break;
        case '3':
          setActiveView('metrics');
          break;
        case '4':
          setActiveView('traces');
          break;
        case 't':
        case 'T':
          window.dispatchEvent(new CustomEvent('kubeseer:toggle-assistant'));
          break;
        case 'c':
        case 'C':
          // Focus and open the cluster selector dropdown
          document.querySelector<HTMLButtonElement>('.dropdown__trigger')?.click();
          break;
        case '?':
          setShowHelp((prev) => !prev);
          break;
        case 'Escape':
          setShowHelp(false);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveView]);

  return { showHelp, setShowHelp };
}

export const SHORTCUTS = [
  { keys: ['/'], description: 'Open resource search' },
  { keys: ['T'], description: 'Toggle troubleshoot assistant' },
  { keys: ['C'], description: 'Open cluster selector' },
  { keys: ['1'], description: 'Switch to Topology' },
  { keys: ['2'], description: 'Switch to Logs' },
  { keys: ['3'], description: 'Switch to Metrics' },
  { keys: ['4'], description: 'Switch to Traces' },
  { keys: ['?'], description: 'Toggle shortcuts help' },
  { keys: ['Esc'], description: 'Close overlays' },
];
