import { useMemo } from 'react';

interface DeployEvent {
  id: string;
  service: string;
  action: 'rollout' | 'scale' | 'rollback' | 'config-change';
  timestamp: number;
  detail: string;
}

interface DeploymentTimelineProps {
  clusterId: string;
}

// Seeded RNG for stable timeline events
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SERVICES = ['api-gateway', 'user-service', 'payment-service', 'notification-service', 'order-service'];
const ACTIONS: DeployEvent['action'][] = ['rollout', 'scale', 'rollback', 'config-change'];
const ACTION_DETAILS: Record<string, string[]> = {
  rollout: ['image: v2.3.1 → v2.4.0', 'image: v1.8.0 → v1.8.1', 'image: latest → v3.0.0-rc1'],
  scale: ['replicas: 2 → 4', 'replicas: 3 → 5', 'replicas: 4 → 2'],
  rollback: ['rolled back to v2.3.0', 'rolled back to v1.7.9', 'automatic rollback triggered'],
  'config-change': ['updated env: DB_POOL_SIZE=50', 'configmap: redis-config updated', 'secret: api-keys rotated'],
};

export function DeploymentTimeline({ clusterId }: DeploymentTimelineProps) {
  const events = useMemo((): DeployEvent[] => {
    const rng = seeded(hashStr(clusterId + ':timeline'));
    const now = Date.now();
    const result: DeployEvent[] = [];

    for (let i = 0; i < 12; i++) {
      const action = ACTIONS[Math.floor(rng() * ACTIONS.length)];
      const details = ACTION_DETAILS[action];
      result.push({
        id: `deploy-${i}`,
        service: SERVICES[Math.floor(rng() * SERVICES.length)],
        action,
        timestamp: now - (i * 3600000 * (1 + rng() * 3)), // spread over ~36 hours
        detail: details[Math.floor(rng() * details.length)],
      });
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [clusterId]);

  const now = Date.now();

  return (
    <div className="deploy-timeline">
      <h3 className="deploy-timeline__title">Recent Deployments</h3>
      <div className="deploy-timeline__track">
        {events.map((event) => {
          const ago = now - event.timestamp;
          const agoStr = ago < 3600000
            ? `${Math.floor(ago / 60000)}m ago`
            : ago < 86400000
            ? `${Math.floor(ago / 3600000)}h ago`
            : `${Math.floor(ago / 86400000)}d ago`;

          return (
            <div key={event.id} className={`deploy-timeline__event deploy-timeline__event--${event.action}`}>
              <div className="deploy-timeline__dot" />
              <div className="deploy-timeline__content">
                <div className="deploy-timeline__header">
                  <span className="deploy-timeline__service">{event.service}</span>
                  <span className={`deploy-timeline__action deploy-timeline__action--${event.action}`}>
                    {event.action}
                  </span>
                  <span className="deploy-timeline__time">{agoStr}</span>
                </div>
                <p className="deploy-timeline__detail">{event.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
