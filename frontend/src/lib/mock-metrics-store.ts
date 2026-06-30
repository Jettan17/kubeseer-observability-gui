/**
 * Stable mock metrics data store.
 * 
 * Generates a full 7-day dataset per cluster ONCE using a seeded PRNG,
 * then time window selection just slices into the pre-generated data.
 * This ensures switching between clusters/windows always shows the same shape.
 */

import { MetricSeries, TimeSeriesPoint, TimeWindow } from '../stores/metrics';

// Seeded pseudo-random number generator (mulberry32)
function seededRng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a string to a number for seeding
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

interface MetricDefinition {
  name: string;
  unit: string;
  base: number;
  variance: number;
  frequency: number; // oscillation frequency
}

const METRIC_DEFS: MetricDefinition[] = [
  { name: 'CPU Usage', unit: 'millicores', base: 350, variance: 150, frequency: 0.12 },
  { name: 'Memory Usage', unit: 'MiB', base: 380, variance: 50, frequency: 0.04 },
  { name: 'Network RX', unit: 'KB/s', base: 200, variance: 80, frequency: 0.18 },
  { name: 'Network TX', unit: 'KB/s', base: 150, variance: 60, frequency: 0.15 },
];

// Store pre-generated data per cluster
const clusterDataCache = new Map<string, MetricSeries[]>();

const TOTAL_DURATION_SECONDS = 7 * 24 * 3600; // 7 days
const INTERVAL_SECONDS = 15; // 15-second resolution
const TOTAL_POINTS = Math.floor(TOTAL_DURATION_SECONDS / INTERVAL_SECONDS);

/**
 * Generate the full 7-day dataset for a cluster (deterministic).
 */
function generateFullDataset(clusterId: string): MetricSeries[] {
  if (clusterDataCache.has(clusterId)) {
    return clusterDataCache.get(clusterId)!;
  }

  const series: MetricSeries[] = [];
  const now = Date.now();

  for (const def of METRIC_DEFS) {
    const rng = seededRng(hashString(`${clusterId}:${def.name}`));
    const points: TimeSeriesPoint[] = [];

    let value = def.base;
    for (let i = 0; i < TOTAL_POINTS; i++) {
      // Smooth random walk + sinusoidal pattern
      const noise = (rng() - 0.5) * def.variance * 0.15;
      const wave = Math.sin(i * def.frequency) * def.variance * 0.5;
      const trend = Math.sin(i / (TOTAL_POINTS / 3)) * def.variance * 0.3;
      
      value = value * 0.97 + (def.base + wave + trend) * 0.03 + noise;
      value = Math.max(def.base * 0.1, Math.min(def.base * 2.5, value));

      points.push({
        timestamp: now - (TOTAL_POINTS - i) * INTERVAL_SECONDS * 1000,
        value,
      });
    }

    series.push({ name: def.name, unit: def.unit, points });
  }

  clusterDataCache.set(clusterId, series);
  return series;
}

const WINDOW_SECONDS: Record<TimeWindow, number> = {
  '5m': 300,
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
  '7d': 604800,
};

/**
 * Get metrics for a cluster, sliced to the specified time window.
 * The underlying data is stable — only the visible range changes.
 */
export function getMetricsForWindow(clusterId: string, window: TimeWindow): MetricSeries[] {
  const fullData = generateFullDataset(clusterId);
  const windowSeconds = WINDOW_SECONDS[window];
  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;

  // Downsample for smaller windows to keep ~120 points on screen
  const targetPoints = 120;
  
  return fullData.map((series) => {
    const windowedPoints = series.points.filter((p) => p.timestamp >= cutoff);
    
    // Downsample if too many points
    if (windowedPoints.length <= targetPoints) {
      return { ...series, points: windowedPoints };
    }

    const step = Math.floor(windowedPoints.length / targetPoints);
    const downsampled: TimeSeriesPoint[] = [];
    for (let i = 0; i < windowedPoints.length; i += step) {
      downsampled.push(windowedPoints[i]);
    }
    // Always include the last point
    if (downsampled[downsampled.length - 1] !== windowedPoints[windowedPoints.length - 1]) {
      downsampled.push(windowedPoints[windowedPoints.length - 1]);
    }

    return { ...series, points: downsampled };
  });
}
