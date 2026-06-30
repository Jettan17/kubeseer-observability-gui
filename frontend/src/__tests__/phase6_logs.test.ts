/**
 * Phase 6 Test Suite: Log Viewer Validation
 *
 * Tests log store operations, filtering, and performance.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useLogStore, LogLine } from '../stores/logs';

function makeLine(i: number, container = 'app', level: LogLine['level'] = 'info'): LogLine {
  return {
    timestamp: `2024-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    container,
    level,
    message: `Log message ${i}`,
  };
}

describe('Log Store', () => {
  beforeEach(() => {
    useLogStore.getState().clear();
  });

  it('appends lines to buffer', () => {
    const { appendLines } = useLogStore.getState();
    appendLines([makeLine(1), makeLine(2), makeLine(3)]);
    expect(useLogStore.getState().lines).toHaveLength(3);
  });

  it('enforces max buffer size', () => {
    const store = useLogStore.getState();
    // Override maxLines for test
    useLogStore.setState({ maxLines: 100 });

    const lines = Array.from({ length: 150 }, (_, i) => makeLine(i));
    store.appendLines(lines);

    expect(useLogStore.getState().lines).toHaveLength(100);
    // Should keep the latest 100
    expect(useLogStore.getState().lines[0].message).toBe('Log message 50');
  });

  it('sets search query', () => {
    const { setSearchQuery } = useLogStore.getState();
    setSearchQuery('error');
    expect(useLogStore.getState().searchQuery).toBe('error');
  });

  it('toggles level filter', () => {
    const { toggleLevelFilter } = useLogStore.getState();
    // Initially all levels active
    expect(useLogStore.getState().levelFilter.has('error')).toBe(true);

    toggleLevelFilter('error');
    expect(useLogStore.getState().levelFilter.has('error')).toBe(false);

    toggleLevelFilter('error');
    expect(useLogStore.getState().levelFilter.has('error')).toBe(true);
  });

  it('clears all state', () => {
    const store = useLogStore.getState();
    store.appendLines([makeLine(1), makeLine(2)]);
    store.setSearchQuery('test');
    store.clear();

    const state = useLogStore.getState();
    expect(state.lines).toHaveLength(0);
    expect(state.searchQuery).toBe('');
  });

  it('manages pinned state', () => {
    const { setPinned } = useLogStore.getState();
    setPinned(false);
    expect(useLogStore.getState().isPinned).toBe(false);
    setPinned(true);
    expect(useLogStore.getState().isPinned).toBe(true);
  });
});

describe('Log Property Tests', () => {
  beforeEach(() => {
    useLogStore.getState().clear();
    useLogStore.setState({ maxLines: 1_000_000 });
  });

  // Property 2: Log Ordering Invariant
  it('property: timestamps remain ordered after append', () => {
    const store = useLogStore.getState();
    const batch1 = Array.from({ length: 50 }, (_, i) => ({
      timestamp: new Date(1704067200000 + i * 1000).toISOString(),
      container: 'app',
      level: 'info' as const,
      message: `msg ${i}`,
    }));
    store.appendLines(batch1);

    const batch2 = Array.from({ length: 50 }, (_, i) => ({
      timestamp: new Date(1704067200000 + (50 + i) * 1000).toISOString(),
      container: 'app',
      level: 'info' as const,
      message: `msg ${50 + i}`,
    }));
    store.appendLines(batch2);

    const lines = useLogStore.getState().lines;
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].timestamp >= lines[i - 1].timestamp).toBe(true);
    }
  });

  // Property 3: Multi-Container Log Merge Completeness
  it('property: merged logs contain all input lines', () => {
    const store = useLogStore.getState();
    const containerA = Array.from({ length: 30 }, (_, i) => makeLine(i, 'container-a'));
    const containerB = Array.from({ length: 20 }, (_, i) => makeLine(i, 'container-b'));

    store.appendLines(containerA);
    store.appendLines(containerB);

    const all = useLogStore.getState().lines;
    expect(all).toHaveLength(50); // 30 + 20
    expect(all.filter((l) => l.container === 'container-a')).toHaveLength(30);
    expect(all.filter((l) => l.container === 'container-b')).toHaveLength(20);
  });
});

describe('Stress: Log performance', () => {
  beforeEach(() => {
    useLogStore.getState().clear();
    useLogStore.setState({ maxLines: 1_000_000 });
  });

  it('handles 100K lines append', () => {
    const store = useLogStore.getState();
    const lines = Array.from({ length: 100_000 }, (_, i) => makeLine(i));

    const start = performance.now();
    store.appendLines(lines);
    const elapsed = performance.now() - start;

    expect(useLogStore.getState().lines).toHaveLength(100_000);
    // Should complete in under 1 second
    expect(elapsed).toBeLessThan(1000);
  });

  it('search filter on 10K lines is fast', () => {
    const store = useLogStore.getState();
    const lines = Array.from({ length: 10_000 }, (_, i) => ({
      timestamp: `2024-01-01T00:00:00Z`,
      container: 'app',
      level: (i % 3 === 0 ? 'error' : 'info') as LogLine['level'],
      message: i % 100 === 0 ? `ERROR: connection failed #${i}` : `Normal log ${i}`,
    }));
    store.appendLines(lines);

    const start = performance.now();
    const allLines = useLogStore.getState().lines;
    const filtered = allLines.filter((l) =>
      l.message.toLowerCase().includes('connection failed')
    );
    const elapsed = performance.now() - start;

    expect(filtered.length).toBe(100); // every 100th line
    expect(elapsed).toBeLessThan(200); // < 200ms
  });
});
