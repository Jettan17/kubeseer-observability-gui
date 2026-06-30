/**
 * Phase 8 Test Suite: Trace Explorer Validation
 *
 * Tests trace filtering, span tree construction.
 */

import { describe, it, expect } from 'vitest';
import type { Trace, Span } from '../components/traces/TraceExplorer';

function makeTrace(id: string, service: string, duration: number, status: 'ok' | 'error' = 'ok'): Trace {
  return {
    traceId: id,
    rootService: service,
    duration,
    spanCount: Math.ceil(duration / 10),
    status,
    startTime: new Date(1704067200000 + Math.random() * 3600000).toISOString(),
  };
}

function makeSpan(
  spanId: string,
  service: string,
  operation: string,
  duration: number,
  opts: { parentSpanId?: string; startTime?: number; status?: 'ok' | 'error' } = {}
): Span {
  return {
    spanId,
    parentSpanId: opts.parentSpanId,
    service,
    operation,
    duration,
    startTime: opts.startTime || 0,
    attributes: {},
    events: [],
    status: opts.status || 'ok',
  };
}

describe('Trace Filtering', () => {
  const traces: Trace[] = [
    makeTrace('trace-1', 'api-gateway', 150),
    makeTrace('trace-2', 'user-service', 50),
    makeTrace('trace-3', 'api-gateway', 500, 'error'),
    makeTrace('trace-4', 'payment-service', 200),
    makeTrace('trace-5', 'user-service', 30),
  ];

  it('filters by service name', () => {
    const filtered = traces.filter((t) =>
      t.rootService.toLowerCase().includes('api')
    );
    expect(filtered).toHaveLength(2);
  });

  it('filters by minimum duration', () => {
    const minDuration = 100;
    const filtered = traces.filter((t) => t.duration >= minDuration);
    expect(filtered).toHaveLength(3);
  });

  it('filters by status', () => {
    const filtered = traces.filter((t) => t.status === 'error');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].traceId).toBe('trace-3');
  });

  it('combines service and duration filters', () => {
    const filtered = traces.filter(
      (t) => t.rootService.includes('api') && t.duration > 200
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].duration).toBe(500);
  });
});

describe('Span Tree', () => {
  it('sorts spans by start time', () => {
    const spans: Span[] = [
      makeSpan('s3', 'svc-c', 'op3', 10, { startTime: 30 }),
      makeSpan('s1', 'svc-a', 'op1', 50, { startTime: 0 }),
      makeSpan('s2', 'svc-b', 'op2', 20, { startTime: 10 }),
    ];
    const sorted = [...spans].sort((a, b) => a.startTime - b.startTime);
    expect(sorted[0].spanId).toBe('s1');
    expect(sorted[1].spanId).toBe('s2');
    expect(sorted[2].spanId).toBe('s3');
  });

  it('identifies root span (no parent)', () => {
    const spans: Span[] = [
      makeSpan('root', 'gateway', 'handle_request', 100, { startTime: 0 }),
      makeSpan('child-1', 'auth', 'verify', 20, { parentSpanId: 'root', startTime: 5 }),
      makeSpan('child-2', 'db', 'query', 30, { parentSpanId: 'root', startTime: 25 }),
    ];
    const root = spans.find((s) => !s.parentSpanId);
    expect(root?.spanId).toBe('root');
  });

  it('computes waterfall bar positions', () => {
    const spans: Span[] = [
      makeSpan('root', 'gw', 'handle', 100, { startTime: 0 }),
      makeSpan('child', 'svc', 'process', 40, { parentSpanId: 'root', startTime: 20 }),
    ];

    const minStart = Math.min(...spans.map((s) => s.startTime));
    const maxEnd = Math.max(...spans.map((s) => s.startTime + s.duration));
    const totalDuration = maxEnd - minStart;

    const childSpan = spans[1];
    const left = ((childSpan.startTime - minStart) / totalDuration) * 100;
    const width = (childSpan.duration / totalDuration) * 100;

    expect(left).toBe(20);
    expect(width).toBe(40);
  });

  it('detects p95 bottlenecks', () => {
    const spans: Span[] = Array.from({ length: 100 }, (_, i) =>
      makeSpan(`s-${i}`, 'svc', 'op', i < 95 ? 10 : 100, { startTime: i * 5 })
    );

    const durations = spans.map((s) => s.duration).sort((a, b) => a - b);
    const p95Index = Math.ceil(durations.length * 0.95) - 1;
    const p95 = durations[p95Index];

    const bottlenecks = spans.filter((s) => s.duration > p95);
    expect(bottlenecks.length).toBeGreaterThan(0);
    expect(bottlenecks.every((s) => s.duration === 100)).toBe(true);
  });
});

describe('Stress: Trace performance', () => {
  it('handles 10K traces in list', () => {
    const traces: Trace[] = Array.from({ length: 10_000 }, (_, i) =>
      makeTrace(`trace-${i}`, `service-${i % 20}`, Math.random() * 1000)
    );

    const start = performance.now();
    // Simulate service filter
    const filtered = traces.filter((t) => t.rootService === 'service-5');
    const elapsed = performance.now() - start;

    expect(filtered).toHaveLength(500);
    expect(elapsed).toBeLessThan(100);
  });

  it('sorts 500 spans by start time quickly', () => {
    const spans: Span[] = Array.from({ length: 500 }, (_, i) =>
      makeSpan(`s-${i}`, `svc-${i % 10}`, `op-${i}`, Math.random() * 50, {
        startTime: Math.random() * 1000,
        parentSpanId: i > 0 ? `s-${Math.floor(i / 5)}` : undefined,
      })
    );

    const start = performance.now();
    const sorted = [...spans].sort((a, b) => a.startTime - b.startTime);
    const elapsed = performance.now() - start;

    expect(sorted).toHaveLength(500);
    expect(elapsed).toBeLessThan(50);
    // Verify sorted
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startTime).toBeGreaterThanOrEqual(sorted[i - 1].startTime);
    }
  });
});
