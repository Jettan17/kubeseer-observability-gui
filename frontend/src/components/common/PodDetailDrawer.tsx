import { useEffect } from 'react';
import { ResourceNode } from '../../stores/cluster';
import { useUIStore } from '../../stores/ui';
import { useLogStore } from '../../stores/logs';
import { generateMockLogs } from '../../lib/mock-data';

interface PodDetailDrawerProps {
  resource: ResourceNode | null;
  onClose: () => void;
}

export function PodDetailDrawer({ resource, onClose }: PodDetailDrawerProps) {
  const setActiveView = useUIStore((s) => s.setActiveView);

  // Close on Escape
  useEffect(() => {
    if (!resource) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [resource, onClose]);

  if (!resource) return null;

  const handleViewLogs = () => {
    // Filter logs to this container/pod
    const logStore = useLogStore.getState();
    logStore.clear();
    logStore.appendLines(
      generateMockLogs(100).map((l) => ({ ...l, container: resource.name.split('-')[0] }))
    );
    setActiveView('logs');
    onClose();
  };

  const statusColor = resource.status.state === 'healthy' ? 'var(--status-healthy)' :
    resource.status.state === 'warning' ? 'var(--status-warning)' :
    resource.status.state === 'critical' ? 'var(--status-critical)' : 'var(--text-tertiary)';

  const ageStr = resource.ageSeconds
    ? resource.ageSeconds > 86400
      ? `${Math.floor(resource.ageSeconds / 86400)}d`
      : resource.ageSeconds > 3600
      ? `${Math.floor(resource.ageSeconds / 3600)}h`
      : `${Math.floor(resource.ageSeconds / 60)}m`
    : 'unknown';

  return (
    <div className="pod-drawer-overlay" onClick={onClose}>
      <aside className="pod-drawer" onClick={(e) => e.stopPropagation()} role="complementary" aria-label="Resource details">
        <header className="pod-drawer__header">
          <div>
            <span className="pod-drawer__kind">{resource.kind}</span>
            <h2 className="pod-drawer__name">{resource.name}</h2>
          </div>
          <button className="pod-drawer__close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="pod-drawer__body">
          {/* Status section */}
          <section className="pod-drawer__section">
            <h3>Status</h3>
            <div className="pod-drawer__status-row">
              <span className="pod-drawer__status-dot" style={{ background: statusColor }} />
              <span className="pod-drawer__status-text">{resource.status.state}</span>
              {'message' in resource.status && (
                <span className="pod-drawer__status-msg">{(resource.status as any).message}</span>
              )}
            </div>
          </section>

          {/* Metadata */}
          <section className="pod-drawer__section">
            <h3>Details</h3>
            <dl className="pod-drawer__details">
              {resource.namespace && (
                <>
                  <dt>Namespace</dt>
                  <dd>{resource.namespace}</dd>
                </>
              )}
              <dt>Age</dt>
              <dd>{ageStr}</dd>
              {resource.restartCount !== undefined && (
                <>
                  <dt>Restarts</dt>
                  <dd className={resource.restartCount > 3 ? 'pod-drawer__value--critical' : ''}>{resource.restartCount}</dd>
                </>
              )}
              <dt>Cluster</dt>
              <dd>{resource.clusterId}</dd>
            </dl>
          </section>

          {/* Resource usage */}
          {resource.metrics && (
            <section className="pod-drawer__section">
              <h3>Resource Usage</h3>
              <div className="pod-drawer__metrics">
                <div className="pod-drawer__metric">
                  <span className="pod-drawer__metric-label">CPU</span>
                  <span className="pod-drawer__metric-value">
                    {resource.metrics.cpuUsageMillicores}m
                    {resource.metrics.cpuLimitMillicores && ` / ${resource.metrics.cpuLimitMillicores}m`}
                  </span>
                  {resource.metrics.cpuLimitMillicores && (
                    <div className="pod-drawer__bar">
                      <div className="pod-drawer__bar-fill" style={{ width: `${Math.min(100, (resource.metrics.cpuUsageMillicores / resource.metrics.cpuLimitMillicores) * 100)}%` }} />
                    </div>
                  )}
                </div>
                <div className="pod-drawer__metric">
                  <span className="pod-drawer__metric-label">Memory</span>
                  <span className="pod-drawer__metric-value">
                    {Math.round(resource.metrics.memoryUsageBytes / 1024 / 1024)}Mi
                    {resource.metrics.memoryLimitBytes && ` / ${Math.round(resource.metrics.memoryLimitBytes / 1024 / 1024)}Mi`}
                  </span>
                  {resource.metrics.memoryLimitBytes && (
                    <div className="pod-drawer__bar">
                      <div className="pod-drawer__bar-fill" style={{ width: `${Math.min(100, (resource.metrics.memoryUsageBytes / resource.metrics.memoryLimitBytes) * 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Labels */}
          {Object.keys(resource.labels).length > 0 && (
            <section className="pod-drawer__section">
              <h3>Labels</h3>
              <div className="pod-drawer__labels">
                {Object.entries(resource.labels).map(([k, v]) => (
                  <span key={k} className="pod-drawer__label">{k}={v}</span>
                ))}
              </div>
            </section>
          )}

          {/* Actions */}
          <section className="pod-drawer__section pod-drawer__actions">
            <button className="pod-drawer__action-btn pod-drawer__action-btn--primary" onClick={handleViewLogs}>
              View Logs
            </button>
            <button className="pod-drawer__action-btn" onClick={() => { setActiveView('metrics'); onClose(); }}>
              View Metrics
            </button>
            <button className="pod-drawer__action-btn" onClick={() => { setActiveView('traces'); onClose(); }}>
              View Traces
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}
