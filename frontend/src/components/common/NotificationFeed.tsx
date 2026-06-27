import { useState } from 'react';

export interface Notification {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  resource: string;
  namespace?: string;
  message: string;
  eventType: string;
}

interface NotificationFeedProps {
  notifications: Notification[];
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationFeed({ notifications, onNotificationClick }: NotificationFeedProps) {
  const [severityFilter, setSeverityFilter] = useState<string>('');

  const filtered = severityFilter
    ? notifications.filter((n) => n.severity === severityFilter)
    : notifications;

  return (
    <div className="notification-feed">
      <div className="notification-feed__header">
        <h3>Events</h3>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          aria-label="Filter by severity"
        >
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>
      <ul className="notification-feed__list" role="list" aria-label="Cluster events">
        {filtered.map((n) => (
          <li key={n.id} className={`notification-item notification-item--${n.severity}`}>
            <button
              className="notification-item__btn"
              onClick={() => onNotificationClick?.(n)}
            >
              <div className="notification-item__header">
                <span className="notification-item__type">{n.eventType}</span>
                <time className="notification-item__time">
                  {new Date(n.timestamp).toLocaleTimeString()}
                </time>
              </div>
              <div className="notification-item__body">
                <span className="notification-item__resource">
                  {n.namespace && `${n.namespace}/`}{n.resource}
                </span>
                <span className="notification-item__message">{n.message}</span>
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="notification-feed__empty">No events to display</li>
        )}
      </ul>
    </div>
  );
}
