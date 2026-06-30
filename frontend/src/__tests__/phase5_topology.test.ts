/**
 * Phase 5 Test Suite: Topology Visualization Validation
 *
 * Tests layout engine, filtering, and link building.
 */

import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  buildLinks,
  filterNodes,
  LayoutNode,
} from '../components/topology/layout-engine';

function makeNode(
  id: string,
  kind: string,
  name: string,
  opts: { namespace?: string; status?: string; parentId?: string } = {}
): LayoutNode {
  return {
    id,
    kind,
    name,
    namespace: opts.namespace || 'default',
    status: opts.status || 'healthy',
    parentId: opts.parentId,
    radius: 12,
  };
}

describe('Layout Engine', () => {
  it('computes layout positions for nodes', async () => {
    const nodes = [
      makeNode('pod-1', 'Pod', 'nginx-1'),
      makeNode('pod-2', 'Pod', 'nginx-2'),
      makeNode('svc-1', 'Service', 'nginx-svc'),
    ];
    const links = buildLinks(nodes);
    const result = await computeLayout(nodes, links, 800, 600);

    expect(result.nodes).toHaveLength(3);
    // All nodes should have x,y positions after layout
    result.nodes.forEach((n) => {
      expect(n.x).toBeDefined();
      expect(n.y).toBeDefined();
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
    });
  });

  it('assigns radii based on kind', async () => {
    const nodes = [
      makeNode('n-1', 'Node', 'k8s-node'),
      makeNode('pod-1', 'Pod', 'nginx'),
      makeNode('deploy-1', 'Deployment', 'nginx-deploy'),
    ];
    const result = await computeLayout(nodes, [], 800, 600);

    const nodeN = result.nodes.find((n) => n.id === 'n-1')!;
    const pod = result.nodes.find((n) => n.id === 'pod-1')!;
    const deploy = result.nodes.find((n) => n.id === 'deploy-1')!;

    expect(nodeN.radius).toBe(30);
    expect(pod.radius).toBe(12);
    expect(deploy.radius).toBe(20);
  });
});

describe('buildLinks', () => {
  it('creates ownership links from parentId', () => {
    const nodes = [
      makeNode('rs-1', 'ReplicaSet', 'nginx-rs'),
      makeNode('pod-1', 'Pod', 'nginx-1', { parentId: 'rs-1' }),
      makeNode('pod-2', 'Pod', 'nginx-2', { parentId: 'rs-1' }),
      makeNode('pod-3', 'Pod', 'standalone'),
    ];
    const links = buildLinks(nodes);

    expect(links).toHaveLength(2);
    expect(links[0].type).toBe('ownership');
    expect(links[0].source).toBe('rs-1');
    expect(links[0].target).toBe('pod-1');
  });

  it('skips links with missing parents', () => {
    const nodes = [
      makeNode('pod-1', 'Pod', 'orphan', { parentId: 'nonexistent' }),
    ];
    const links = buildLinks(nodes);
    expect(links).toHaveLength(0);
  });
});

describe('filterNodes', () => {
  const nodes = [
    makeNode('pod-1', 'Pod', 'nginx', { namespace: 'default', status: 'healthy' }),
    makeNode('pod-2', 'Pod', 'redis', { namespace: 'cache', status: 'warning' }),
    makeNode('pod-3', 'Pod', 'postgres', { namespace: 'default', status: 'critical' }),
    makeNode('pod-4', 'Pod', 'app-server', { namespace: 'app', status: 'healthy' }),
  ];

  it('filters by namespace', () => {
    const result = filterNodes(nodes, { namespace: 'default' });
    expect(result).toHaveLength(2);
    expect(result.every((n) => n.namespace === 'default')).toBe(true);
  });

  it('filters by status', () => {
    const result = filterNodes(nodes, { status: 'healthy' });
    expect(result).toHaveLength(2);
  });

  it('filters by search term', () => {
    const result = filterNodes(nodes, { search: 'ngi' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('nginx');
  });

  it('combines multiple filters', () => {
    const result = filterNodes(nodes, { namespace: 'default', status: 'critical' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('postgres');
  });

  it('returns all with empty filter', () => {
    const result = filterNodes(nodes, {});
    expect(result).toHaveLength(4);
  });

  // Property: Filter idempotence
  it('property: applying filter twice produces same result', () => {
    const filter = { namespace: 'default', status: 'healthy' };
    const first = filterNodes(nodes, filter);
    const second = filterNodes(first, filter);
    expect(second).toEqual(first);
  });
});

describe('Stress: Layout at scale', () => {
  it('handles 500 nodes without error', async () => {
    const nodes: LayoutNode[] = [];
    for (let i = 0; i < 500; i++) {
      nodes.push(makeNode(`pod-${i}`, 'Pod', `pod-${i}`, {
        parentId: i > 0 && i % 20 === 0 ? `pod-${i - 20}` : undefined,
      }));
    }
    const links = buildLinks(nodes);
    const start = performance.now();
    const result = await computeLayout(nodes, links, 1200, 900);
    const elapsed = performance.now() - start;

    expect(result.nodes).toHaveLength(500);
    // Should complete in under 5 seconds
    expect(elapsed).toBeLessThan(5000);
  });

  it('handles 1000 filter operations rapidly', () => {
    const nodes: LayoutNode[] = [];
    for (let i = 0; i < 1000; i++) {
      nodes.push(makeNode(`pod-${i}`, 'Pod', `pod-${i}`, {
        namespace: `ns-${i % 10}`,
        status: i % 5 === 0 ? 'warning' : 'healthy',
      }));
    }

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      filterNodes(nodes, { namespace: `ns-${i % 10}` });
    }
    const elapsed = performance.now() - start;

    // 1000 filter operations on 1000 nodes should be < 500ms
    expect(elapsed).toBeLessThan(500);
  });
});
