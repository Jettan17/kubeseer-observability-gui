/**
 * Phase 13.10 Test Suite: AI Troubleshooting Assistant (Rule-Based Engine)
 *
 * TDD: Tests written first, engine implemented to pass them.
 */

import { describe, it, expect } from 'vitest';
import { analyze, type AnalysisContext } from '../lib/troubleshoot-engine';
import type { ResourceNode } from '../stores/cluster';
import type { LogLine } from '../stores/logs';

// Helper to build mock context
function makeContext(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    resources: overrides.resources || [],
    logs: overrides.logs || [],
    deployEvents: overrides.deployEvents || [],
  };
}

function makePod(name: string, status: string, opts: Partial<ResourceNode> = {}): ResourceNode {
  return {
    uid: `uid-${name}`,
    kind: 'Pod',
    name,
    namespace: opts.namespace || 'production',
    status: status === 'healthy'
      ? { state: 'healthy' }
      : status === 'warning'
      ? { state: 'warning', message: opts.status?.state === 'warning' ? (opts.status as any).message : 'Pending' }
      : { state: 'critical', message: (opts.status as any)?.message || 'CrashLoopBackOff' },
    labels: opts.labels || { app: name.split('-')[0] },
    clusterId: 'prod',
    restartCount: opts.restartCount,
    ageSeconds: opts.ageSeconds,
    metrics: opts.metrics,
    ...opts,
  } as ResourceNode;
}

function makeLog(message: string, level: LogLine['level'] = 'error', container = 'app'): LogLine {
  return { timestamp: new Date().toISOString(), container, level, message };
}

describe('Troubleshoot Engine - Intent Parsing', () => {
  it('identifies "why is X crashing" as a resource diagnosis', () => {
    const ctx = makeContext({
      resources: [makePod('payment-service-abc', 'critical', { restartCount: 12 })],
    });
    const result = analyze('why is payment-service crashing', ctx);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].resource).toContain('payment-service');
  });

  it('identifies "what is wrong" as cluster-wide health check', () => {
    const ctx = makeContext({
      resources: [
        makePod('pod-a', 'critical'),
        makePod('pod-b', 'warning'),
        makePod('pod-c', 'healthy'),
      ],
    });
    const result = analyze('what is wrong', ctx);
    expect(result.findings.length).toBe(2); // critical + warning, not healthy
  });

  it('identifies "high memory" as resource usage query', () => {
    const ctx = makeContext({
      resources: [
        makePod('heavy-pod', 'healthy', {
          metrics: { cpuUsageMillicores: 200, memoryUsageBytes: 450 * 1024 * 1024, memoryLimitBytes: 512 * 1024 * 1024, cpuLimitMillicores: 1000 },
        }),
        makePod('light-pod', 'healthy', {
          metrics: { cpuUsageMillicores: 50, memoryUsageBytes: 100 * 1024 * 1024, memoryLimitBytes: 512 * 1024 * 1024, cpuLimitMillicores: 1000 },
        }),
      ],
    });
    const result = analyze('which pods have high memory usage', ctx);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].resource).toContain('heavy-pod');
  });

  it('identifies "show errors" as log query', () => {
    const ctx = makeContext({
      logs: [
        makeLog('Connection refused to redis:6379'),
        makeLog('Normal operation', 'info'),
        makeLog('Timeout reaching upstream', 'error'),
      ],
    });
    const result = analyze('show me errors', ctx);
    expect(result.findings.length).toBe(2); // only error logs
  });

  it('identifies "what changed" as deployment history', () => {
    const ctx = makeContext({
      deployEvents: [
        { service: 'api-gateway', action: 'rollout', detail: 'v2.3→v2.4', timestamp: Date.now() - 3600000 },
        { service: 'payment-service', action: 'rollback', detail: 'rolled back', timestamp: Date.now() - 7200000 },
      ],
    });
    const result = analyze('what changed recently', ctx);
    expect(result.findings.length).toBe(2);
  });
});

describe('Troubleshoot Engine - Correlation', () => {
  it('correlates a crashing pod with its error logs', () => {
    const ctx = makeContext({
      resources: [makePod('payment-service-abc', 'critical', { restartCount: 8 })],
      logs: [
        makeLog('OOM killed - container exceeded limit', 'error', 'payment'),
        makeLog('Starting payment processor', 'info', 'payment'),
        makeLog('Unrelated error in auth', 'error', 'auth'),
      ],
    });
    const result = analyze('why is payment-service crashing', ctx);
    expect(result.findings[0].relatedLogs?.length).toBeGreaterThan(0);
    expect(result.findings[0].relatedLogs?.[0]).toContain('OOM');
  });

  it('correlates high resource usage with the pod name', () => {
    const ctx = makeContext({
      resources: [
        makePod('memory-hog-xyz', 'warning', {
          metrics: { cpuUsageMillicores: 900, cpuLimitMillicores: 1000, memoryUsageBytes: 490 * 1024 * 1024, memoryLimitBytes: 512 * 1024 * 1024 },
        }),
      ],
    });
    const result = analyze('high memory', ctx);
    expect(result.findings[0].resource).toContain('memory-hog');
    expect(result.findings[0].detail).toContain('%');
  });
});

describe('Troubleshoot Engine - Edge Cases', () => {
  it('returns a helpful message for unknown questions', () => {
    const ctx = makeContext({});
    const result = analyze('explain quantum computing', ctx);
    expect(result.summary.toLowerCase()).toContain('try');
  });

  it('handles empty stores gracefully', () => {
    const ctx = makeContext({ resources: [], logs: [], deployEvents: [] });
    const result = analyze('what is wrong', ctx);
    expect(result.summary).toBeDefined();
    expect(result.findings).toHaveLength(0);
  });

  it('handles partial resource matches', () => {
    const ctx = makeContext({
      resources: [makePod('api-gateway-12345', 'healthy')],
    });
    const result = analyze('is api-gateway healthy', ctx);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].detail).toContain('healthy');
  });
});
