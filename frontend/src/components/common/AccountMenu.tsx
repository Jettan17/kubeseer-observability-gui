import { useRef, useEffect } from 'react';

interface AccountMenuProps {
  onClose: () => void;
}

export function AccountMenu({ onClose }: AccountMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return (
    <div className="account-menu" ref={ref}>
      <div className="account-menu__header">
        <div className="account-menu__avatar">JD</div>
        <div className="account-menu__info">
          <span className="account-menu__name">Jethro D.</span>
          <span className="account-menu__email">jethro@kubeseer.dev</span>
        </div>
      </div>
      <div className="account-menu__divider" />
      <div className="account-menu__section">
        <span className="account-menu__section-title">Role</span>
        <span className="account-menu__badge">Platform Engineer</span>
      </div>
      <div className="account-menu__section">
        <span className="account-menu__section-title">RBAC</span>
        <span className="account-menu__value">cluster-admin</span>
      </div>
      <div className="account-menu__section">
        <span className="account-menu__section-title">Session</span>
        <span className="account-menu__value">7h 42m remaining</span>
      </div>
      <div className="account-menu__divider" />
      <button className="account-menu__item">
        <span>⚙️</span> Preferences
      </button>
      <button className="account-menu__item">
        <span>🔑</span> API Keys
        <span className="account-menu__hint">Programmatic access</span>
      </button>
      <button className="account-menu__item">
        <span>📋</span> Audit Log
        <span className="account-menu__hint">Activity history</span>
      </button>
      <div className="account-menu__divider" />
      <button className="account-menu__item account-menu__item--danger">
        <span>🚪</span> Sign Out
      </button>
    </div>
  );
}
