import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

interface ShortcutsHelpProps {
  onClose: () => void;
}

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-panel__header">
          <h2>Keyboard Shortcuts</h2>
          <button className="shortcuts-panel__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="shortcuts-panel__list">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="shortcuts-panel__item">
              <div className="shortcuts-panel__keys">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="shortcuts-panel__kbd">{k}</kbd>
                ))}
              </div>
              <span className="shortcuts-panel__desc">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
