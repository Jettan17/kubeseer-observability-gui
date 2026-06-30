/**
 * Phase 9 Test Suite: Multi-Cluster and Unified Search Validation
 *
 * Tests cluster store operations and search logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useClusterStore, ResourceNode, HealthStatus } from '../stores/cluster';

function makeResource(uid: string, name: string, opts: {
  kind?: string;
  namespace?: string;
  clusterId?: string;
  labels?: Record<string, string>;
  status?: HealthStatus;
} = {}): ResourceNode {
  return {
    uid,
    kind: opts.kind || 'Pod',
    name,
    namespace: opts.namespace || 'default',
    status: opts.status || { state: 'healthy' },
    labels: opts.labels || {},
    clusterId: opts.clusterId || 'cluster-1',
  };
}

describe('Cluster Store', () => {
  beforeEach(() => {
    useClusterStore.getState().clearResources();
    useClusterStore.getState().setContexts([]);
    useClusterStore.getState().setConnectionStatus('disconnected');
  });

  it('sets and retrieves contexts', () => {
    useClusterStore.getState().setContexts([
      { name: 'dev', clusterUrl: 'https://dev.k8s.io', connected: true },
      { name: 'prod', clusterUrl: 'https://prod.k8s.io', connected: false },
    ]);
    expect(useClusterStore.getState().contexts).toHaveLength(2);
  });

  it('sets active context', () => {
    useClusterStore.getState().setActiveContext('production');
    expect(useClusterStore.getState().activeContext).toBe('production');
  });

  it('upserts resources', () => {
    const store = useClusterStore.getState();
    store.upsertResource(makeResource('pod-1', 'nginx'));
    store.upsertResource(makeResource('pod-2', 'redis'));
    expect(useClusterStore.getState().resources.size).toBe(2);
  });

  it('removes resources', () => {
    const store = useClusterStore.getState();
    store.upsertResource(makeResource('pod-1', 'nginx'));
    store.removeResource('pod-1');
    expect(useClusterStore.getState().resources.size).toBe(0);
  });

  it('clears all resources', () => {
    const store = useClusterStore.getState();
    store.upsertResource(makeResource('pod-1', 'nginx'));
    store.upsertResource(makeResource('pod-2', 'redis'));
    store.clearResources();
    expect(useClusterStore.getState().resources.size).toBe(0);
  });

  it('tracks connection status', () => {
    useClusterStore.getState().setConnectionStatus('connected');
    expect(useClusterStore.getState().connectionStatus).toBe('connected');
  });
});

describe('Search Logic', () => {
  beforeEach(() => {
    useClusterStore.getState().clearResources();
    const store = useClusterStore.getState();
    store.upsertResource(makeResource('pod-1', 'nginx-frontend', { namespace: 'web', clusterId: 'cluster-1', labels: { app: 'nginx' } }));
    store.upsertResource(makeResource('pod-2', 'redis-cache', { namespace: 'cache', clusterId: 'cluster-1', labels: { app: 'redis' } }));
    store.upsertResource(makeResource('pod-3', 'postgres-db', { namespace: 'data', clusterId: 'cluster-2', labels: { app: 'postgres' } }));
    store.upsertResource(makeResource('svc-1', 'nginx-service', { kind: 'Service', namespace: 'web', clusterId: 'cluster-1' }));
    store.upsertResource(makeResource('deploy-1', 'nginx-deploy', { kind: 'Deployment', namespace: 'web', clusterId: 'cluster-1' }));
  });

  function searchResources(query: string): ResourceNode[] {
    const resources = useClusterStore.getState().resources;
    const lower = query.toLowerCase();
    const results: ResourceNode[] = [];
    for (const r of resources.values()) {
      if (results.length >= 20) break;
      if (r.name.toLowerCase().includes(lower)) {
        results.push(r);
      } else if (r.namespace?.toLowerCase().includes(lower)) {
        results.push(r);
      } else if (Object.values(r.labels).some((v) => v.toLowerCase().includes(lower))) {
        results.push(r);
      }
    }
    return results;
  }

  it('searches by name', () => {
    const results = searchResources('nginx');
    expect(results.length).toBeGreaterThanOrEqual(2); // nginx-frontend, nginx-service, nginx-deploy
  });

  it('searches by namespace', () => {
    const results = searchResources('cache');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('redis-cache');
  });

  it('searches by label value', () => {
    const results = searchResources('postgres');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for no match', () => {
    const results = searchResources('nonexistent-xyz');
    expect(results).toHaveLength(0);
  });

  it('searches across clusters', () => {
    const results = searchResources('postgres');
    expect(results.some((r) => r.clusterId === 'cluster-2')).toBe(true);
  });

  it('limits results to 20', () => {
    // Add 30 resources
    const store = useClusterStore.getState();
    for (let i = 0; i < 30; i++) {
      store.upsertResource(makeResource(`extra-${i}`, `match-resource-${i}`));
    }
    const results = searchResources('match-resource');
    expect(results.length).toBeLessThanOrEqual(20);
  });
});

describe('Stress: Multi-cluster search', () => {
  it('searches 10K resources quickly', () => {
    const store = useClusterStore.getState();
    store.clearResources();

    // Populate 10K resources across 10 clusters
    for (let i = 0; i < 10_000; i++) {
      store.upsertResource(makeResource(
        `pod-${i}`,
        `app-${i % 100}-pod-${i}`,
        { namespace: `ns-${i % 50}`, clusterId: `cluster-${i % 10}` }
      ));
    }

    expect(useClusterStore.getState().resources.size).toBe(10_000);

    // Time a search
    const start = performance.now();
    const resources = useClusterStore.getState().resources;
    const query = 'app-42';
    const results: ResourceNode[] = [];
    for (const r of resources.values()) {
      if (results.length >= 20) break;
      if (r.name.includes(query)) results.push(r);
    }
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100); // < 100ms for 10K search
  });
});
