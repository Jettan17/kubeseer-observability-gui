/**
 * Phase 11 Test Suite: Extensibility and Export Validation
 *
 * Tests log/metrics export utilities and JSON patch application.
 */

import { describe, it, expect } from 'vitest';
import { exportLogsAsText, exportLogsAsJson, exportMetricsAsCsv } from '../lib/export';
import { applyPatches, JsonPatch } from '../lib/json-patch';

describe('Log Export', () => {
  const lines = [
    { timestamp: '2024-01-01T10:00:00Z', container: 'app', level: 'info' as const, message: 'Started' },
    { timestamp: '2024-01-01T10:00:01Z', container: 'app', level: 'error' as const, message: 'Connection failed' },
    { timestamp: '2024-01-01T10:00:02Z', container: 'sidecar', level: 'info' as const, message: 'Ready' },
  ];

  it('exports as plain text with correct format', () => {
    const text = exportLogsAsText(lines);
    const textLines = text.split('\n');
    expect(textLines).toHaveLength(3);
    expect(textLines[0]).toContain('2024-01-01T10:00:00Z');
    expect(textLines[0]).toContain('[app]');
    expect(textLines[0]).toContain('Started');
  });

  it('exports as JSON with all fields', () => {
    const json = exportLogsAsJson(lines);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].timestamp).toBe('2024-01-01T10:00:00Z');
    expect(parsed[0].container).toBe('app');
    expect(parsed[0].level).toBe('info');
    expect(parsed[0].message).toBe('Started');
  });

  it('exports empty array correctly', () => {
    expect(exportLogsAsText([])).toBe('');
    expect(exportLogsAsJson([])).toBe('[]');
  });

  // Property 10: Export Completeness
  it('property: exported lines match input exactly', () => {
    const json = exportLogsAsJson(lines);
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(lines.length);
    for (let i = 0; i < lines.length; i++) {
      expect(parsed[i].message).toBe(lines[i].message);
      expect(parsed[i].timestamp).toBe(lines[i].timestamp);
      expect(parsed[i].container).toBe(lines[i].container);
    }
  });
});

describe('Metrics Export', () => {
  const points = [
    { timestamp: 1704067200000, value: 45.5 },
    { timestamp: 1704067215000, value: 52.3 },
    { timestamp: 1704067230000, value: 48.1 },
  ];

  it('exports as CSV with header', () => {
    const csv = exportMetricsAsCsv('cpu_usage', points);
    const rows = csv.split('\n');
    expect(rows[0]).toBe('timestamp,value');
    expect(rows).toHaveLength(4); // header + 3 data rows
  });

  it('formats timestamps as ISO strings', () => {
    const csv = exportMetricsAsCsv('cpu', points);
    const rows = csv.split('\n');
    expect(rows[1]).toContain('2024-01-01T');
    expect(rows[1]).toContain('45.5');
  });

  it('handles empty points', () => {
    const csv = exportMetricsAsCsv('empty', []);
    expect(csv).toBe('timestamp,value');
  });
});

describe('JSON Patch Application', () => {
  it('applies add operation', () => {
    const target = { name: 'nginx' };
    const patches: JsonPatch[] = [{ op: 'add', path: '/status', value: 'running' }];
    const result = applyPatches(target, patches);
    expect(result).toEqual({ name: 'nginx', status: 'running' });
  });

  it('applies replace operation', () => {
    const target = { name: 'nginx', status: 'pending' };
    const patches: JsonPatch[] = [{ op: 'replace', path: '/status', value: 'running' }];
    const result = applyPatches(target, patches);
    expect(result.status).toBe('running');
  });

  it('applies remove operation', () => {
    const target = { name: 'nginx', status: 'running', temp: true };
    const patches: JsonPatch[] = [{ op: 'remove', path: '/temp' }];
    const result = applyPatches(target, patches);
    expect(result).not.toHaveProperty('temp');
    expect(result.name).toBe('nginx');
  });

  it('applies multiple patches in sequence', () => {
    const target = { a: 1, b: 2 };
    const patches: JsonPatch[] = [
      { op: 'add', path: '/c', value: 3 },
      { op: 'replace', path: '/a', value: 10 },
      { op: 'remove', path: '/b' },
    ];
    const result = applyPatches(target, patches);
    expect(result).toEqual({ a: 10, c: 3 });
  });

  it('handles nested paths', () => {
    const target = { pod: { status: 'pending', name: 'nginx' } };
    const patches: JsonPatch[] = [
      { op: 'replace', path: '/pod/status', value: 'running' },
    ];
    const result = applyPatches(target, patches);
    expect((result as any).pod.status).toBe('running');
    expect((result as any).pod.name).toBe('nginx');
  });

  it('handles empty patch list', () => {
    const target = { name: 'test' };
    const result = applyPatches(target, []);
    expect(result).toEqual(target);
  });

  // Stress
  it('applies 1000 patches quickly', () => {
    let target: Record<string, unknown> = {};
    const patches: JsonPatch[] = Array.from({ length: 1000 }, (_, i) => ({
      op: 'add' as const,
      path: `/key_${i}`,
      value: `value_${i}`,
    }));

    const start = performance.now();
    const result = applyPatches(target, patches);
    const elapsed = performance.now() - start;

    expect(Object.keys(result)).toHaveLength(1000);
    expect(elapsed).toBeLessThan(500); // immutable approach trades speed for safety
  });
});
