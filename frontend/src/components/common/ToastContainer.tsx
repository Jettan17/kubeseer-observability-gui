import { useState, useEffect, useCallback } from 'react';

export interface Toast {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  resource?: string;
  timestamp: number;
}

// Global toast emitter (singleton)
type ToastListener = (toast: Toast) => void;
const listeners: Set<ToastListener> = new Set();

export function emitToast(toast: Omit<Toast, 'id' | 'timestamp'>) {
  const full: Toast = {
    ...toast,
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  listeners.forEach((fn) => fn(full));
}

const AUTO_DISMISS_MS = 5000;
const MAX_TOASTS = 5;

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Subscribe to toast events
  useEffect(() => {
    const handler: ToastListener = (toast) => {
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), toast]);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.timestamp < AUTO_DISMISS_MS));
    }, 1000);
    return () => clearInterval(timer);
  }, [toasts.length]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.severity}`}
          role="alert"
        >
          <div className="toast__content">
            <div className="toast__header">
              <span className="toast__severity">{toast.severity === 'critical' ? '🔴' : toast.severity === 'warning' ? '🟡' : 'ℹ️'}</span>
              <span className="toast__title">{toast.title}</span>
            </div>
            <p className="toast__message">{toast.message}</p>
            {toast.resource && (
              <span className="toast__resource">{toast.resource}</span>
            )}
          </div>
          <button
            className="toast__dismiss"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
