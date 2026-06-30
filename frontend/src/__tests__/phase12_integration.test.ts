/**
 * Phase 12 Test Suite: Final Integration Validation
 *
 * Tests UI store interactions, theme system, and overall state management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../stores/ui';
import { useClusterStore } from '../stores/cluster';
import { useLogStore } from '../stores/logs';
import { useMetricsStore } from '../stores/metrics';

describe('UI Store Integration', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeView: 'topology',
      theme: 'dark',
      sidebarCollapsed: false,
    });
  });

  it('switches between all views', () => {
    const views = ['topology', 'logs', 'metrics', 'traces'] as const;
    for (const view of views) {
      useUIStore.getState().setActiveView(view);
      expect(useUIStore.getState().activeView).toBe(view);
    }
  });

  it('toggles sidebar', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('sets theme', () => {
    useUIStore.getState().setTheme('light');
    expect(useUIStore.getState().theme).toBe('light');
    useUIStore.getState().setTheme('system');
    expect(useUIStore.getState().theme).toBe('system');
  });
});

describe('Cross-Store Integration', () => {
  beforeEach(() => {
    useClusterStore.getState().clearResources();
    useLogStore.getState().clear();
    useMetricsStore.getState().clearSeries();
  });

  it('simulates cluster connect → resource load → log stream', () => {
    // 1. Set connection status
    useClusterStore.getState().setConnectionStatus('connected');
    useClusterStore.getState().setActiveContext('dev-cluster');
    expect(useClusterStore.getState().connectionStatus).toBe('connected');

    // 2. Populate resources
    useClusterStore.getState().upsertResource({
      uid: 'pod-1',
      kind: 'Pod',
      name: 'nginx',
      namespace: 'default',
      status: { state: 'healthy' },
      labels: { app: 'nginx' },
      clusterId: 'cluster-1',
    });
    expect(useClusterStore.getState().resources.size).toBe(1);

    // 3. Stream logs for that pod
    useLogStore.getState().appendLines([
      { timestamp: '2024-01-01T10:00:00Z', container: 'nginx', level: 'info', message: 'Starting' },
      { timestamp: '2024-01-01T10:00:01Z', container: 'nginx', level: 'info', message: 'Listening on :80' },
    ]);
    expect(useLogStore.getState().lines).toHaveLength(2);

    // 4. Load metrics
    useMetricsStore.getState().setSeries('pod-1', [{
      name: 'cpu',
      unit: 'millicores',
      points: [{ timestamp: Date.now(), value: 42 }],
    }]);
    expect(useMetricsStore.getState().series['pod-1']).toHaveLength(1);
  });

  it('simulates cluster disconnect → clear state', () => {
    // Set up connected state
    useClusterStore.getState().setConnectionStatus('connected');
    useClusterStore.getState().upsertResource({
      uid: 'pod-1', kind: 'Pod', name: 'test',
      namespace: 'default', status: { state: 'healthy' },
      labels: {}, clusterId: 'c1',
    });
    useLogStore.getState().appendLines([
      { timestamp: '2024-01-01T10:00:00Z', container: 'app', message: 'test' },
    ]);

    // Disconnect
    useClusterStore.getState().setConnectionStatus('disconnected');
    useClusterStore.getState().clearResources();
    useLogStore.getState().clear();
    useMetricsStore.getState().clearSeries();

    expect(useClusterStore.getState().resources.size).toBe(0);
    expect(useLogStore.getState().lines).toHaveLength(0);
    expect(Object.keys(useMetricsStore.getState().series)).toHaveLength(0);
  });
});

describe('Full System Stress', () => {
  it('handles rapid state transitions', () => {
    const start = performance.now();

    // Simulate rapid UI interactions
    for (let i = 0; i < 1000; i++) {
      const views = ['topology', 'logs', 'metrics', 'traces'] as const;
      useUIStore.getState().setActiveView(views[i % 4]);
    }

    // Simulate rapid resource updates
    for (let i = 0; i < 1000; i++) {
      useClusterStore.getState().upsertResource({
        uid: `pod-${i % 50}`,
        kind: 'Pod',
        name: `pod-${i % 50}`,
        namespace: 'default',
        status: { state: i % 10 === 0 ? 'warning' : 'healthy' } as any,
        labels: {},
        clusterId: 'c1',
      });
    }

    // Simulate log ingestion
    const lines = Array.from({ length: 5000 }, (_, i) => ({
      timestamp: new Date(Date.now() + i).toISOString(),
      container: 'app',
      level: 'info' as const,
      message: `Log ${i}`,
    }));
    useLogStore.getState().appendLines(lines);

    const elapsed = performance.now() - start;

    expect(useClusterStore.getState().resources.size).toBe(50);
    expect(useLogStore.getState().lines).toHaveLength(5000);
    expect(useUIStore.getState().activeView).toBe('traces'); // 1000 % 4 = 0 = topology... actually last is 999%4=3=traces
    expect(elapsed).toBeLessThan(2000); // All operations in < 2s
  });
});
