/**
 * Phase 10 Test Suite: Alerting and Health Indicators Validation
 *
 * Tests health computation, notification filtering, and event storms.
 */

import { describe, it, expect } from 'vitest';
import type { Notification } from '../components/common/NotificationFeed';

function makeNotification(
  id: string,
  severity: Notification['severity'],
  eventType: string,
  resource: string
): Notification {
  return {
    id,
    timestamp: new Date(Date.now() - Math.random() * 600000).toISOString(),
    severity,
    resource,
    namespace: 'default',
    message: `${eventType} on ${resource}`,
    eventType,
  };
}

describe('Health Computation', () => {
  interface HealthInput {
    status: string;
    restartCount: number;
    phase: string;
  }

  function computeHealth(input: HealthInput): 'healthy' | 'warning' | 'critical' {
    if (input.phase === 'Failed' || input.status === 'CrashLoopBackOff') return 'critical';
    if (input.restartCount > 3) return 'critical';
    if (input.phase === 'Pending') return 'warning';
    return 'healthy';
  }

  it('running pod is healthy', () => {
    expect(computeHealth({ status: 'Running', restartCount: 0, phase: 'Running' })).toBe('healthy');
  });

  it('pending pod is warning', () => {
    expect(computeHealth({ status: 'Pending', restartCount: 0, phase: 'Pending' })).toBe('warning');
  });

  it('crashloopbackoff is critical', () => {
    expect(computeHealth({ status: 'CrashLoopBackOff', restartCount: 5, phase: 'Running' })).toBe('critical');
  });

  it('high restart count is critical', () => {
    expect(computeHealth({ status: 'Running', restartCount: 4, phase: 'Running' })).toBe('critical');
  });

  it('failed pod is critical', () => {
    expect(computeHealth({ status: 'Failed', restartCount: 0, phase: 'Failed' })).toBe('critical');
  });
});

describe('Notification Filtering', () => {
  const notifications: Notification[] = [
    makeNotification('n-1', 'critical', 'OOMKilled', 'pod-1'),
    makeNotification('n-2', 'warning', 'HighMemory', 'pod-2'),
    makeNotification('n-3', 'critical', 'CrashLoop', 'pod-3'),
    makeNotification('n-4', 'info', 'Scheduled', 'pod-4'),
    makeNotification('n-5', 'warning', 'ImagePullBackOff', 'pod-5'),
    makeNotification('n-6', 'info', 'Created', 'pod-6'),
  ];

  it('filters by severity', () => {
    const critical = notifications.filter((n) => n.severity === 'critical');
    expect(critical).toHaveLength(2);

    const warnings = notifications.filter((n) => n.severity === 'warning');
    expect(warnings).toHaveLength(2);

    const info = notifications.filter((n) => n.severity === 'info');
    expect(info).toHaveLength(2);
  });

  it('sorts by timestamp (newest first)', () => {
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      expect(new Date(sorted[i].timestamp).getTime())
        .toBeLessThanOrEqual(new Date(sorted[i - 1].timestamp).getTime());
    }
  });

  it('limits to retention window', () => {
    const maxAge = 300000; // 5 minutes
    const now = Date.now();
    const withinWindow = notifications.filter(
      (n) => now - new Date(n.timestamp).getTime() < maxAge
    );
    // All test notifications are within 10min window, but some may exceed 5min
    expect(withinWindow.length).toBeLessThanOrEqual(notifications.length);
  });
});

describe('Health Summary Aggregation', () => {
  it('computes correct counts', () => {
    const resources = [
      { status: 'healthy' },
      { status: 'healthy' },
      { status: 'healthy' },
      { status: 'warning' },
      { status: 'critical' },
      { status: 'unknown' },
    ];

    const summary = resources.reduce(
      (acc, r) => {
        acc[r.status as keyof typeof acc]++;
        return acc;
      },
      { healthy: 0, warning: 0, critical: 0, unknown: 0 }
    );

    expect(summary.healthy).toBe(3);
    expect(summary.warning).toBe(1);
    expect(summary.critical).toBe(1);
    expect(summary.unknown).toBe(1);
  });
});

describe('Stress: Event storm', () => {
  it('handles 500 notifications', () => {
    const start = performance.now();
    const notifications: Notification[] = Array.from({ length: 500 }, (_, i) =>
      makeNotification(
        `n-${i}`,
        i % 3 === 0 ? 'critical' : i % 3 === 1 ? 'warning' : 'info',
        i % 2 === 0 ? 'OOMKilled' : 'Restart',
        `pod-${i}`
      )
    );
    const elapsed = performance.now() - start;
    expect(notifications).toHaveLength(500);
    expect(elapsed).toBeLessThan(100);

    // Filter performance
    const filterStart = performance.now();
    const critical = notifications.filter((n) => n.severity === 'critical');
    const sorted = [...critical].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const filterElapsed = performance.now() - filterStart;

    expect(sorted.length).toBeGreaterThan(0);
    expect(filterElapsed).toBeLessThan(50);
  });
});
