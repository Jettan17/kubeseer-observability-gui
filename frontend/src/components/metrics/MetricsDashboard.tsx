import { useEffect } from 'react';
import { useMetricsStore, TimeWindow, TimeSeriesPoint } from '../../stores/metrics';
import { TimeSeriesChart } from './TimeSeriesChart';
import { ResourceGauge } from './ResourceGauge';

interface MetricsDashboardProps {
  resourceUid?: string;
}

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: '5m', label: '5 min' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
];

const WINDOW_SECONDS: Record<TimeWindow, number> = {
  '5m': 300,
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
  '7d': 604800,
};

function generatePointsForWindow(window: TimeWindow, base: number, variance: number): TimeSeriesPoint[] {
  const seconds = WINDOW_SECONDS[window];
  const interval = Math.max(15, seconds / 120); // ~120 points regardless of window
  const count = Math.floor(seconds / interval);
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    timestamp: now - (count - i) * interval * 1000,
    value: Math.max(0, base + Math.sin(i / 8) * variance + (Math.random() - 0.5) * variance * 0.6),
  }));
}

export function MetricsDashboard({ resourceUid }: MetricsDashboardProps) {
  const timeWindow = useMetricsStore((s) => s.timeWindow);
  const setTimeWindow = useMetricsStore((s) => s.setTimeWindow);
  const series = useMetricsStore((s) => (resourceUid ? s.series[resourceUid] : undefined));
  const setSeries = useMetricsStore((s) => s.setSeries);

  // Regenerate data when time window changes
  useEffect(() => {
    if (!resourceUid) return;
    setSeries(resourceUid, [
      { name: 'CPU Usage', unit: 'millicores', points: generatePointsForWindow(timeWindow, 350, 150) },
      { name: 'Memory Usage', unit: 'MiB', points: generatePointsForWindow(timeWindow, 380, 50) },
      { name: 'Network RX', unit: 'KB/s', points: generatePointsForWindow(timeWindow, 200, 80) },
      { name: 'Network TX', unit: 'KB/s', points: generatePointsForWindow(timeWindow, 150, 60) },
    ]);
  }, [timeWindow, resourceUid, setSeries]);

  return (
    <div className="metrics-dashboard">
      <div className="metrics-dashboard__controls" role="toolbar" aria-label="Metrics controls">
        <div className="metrics-dashboard__time-selector" role="group" aria-label="Time window">
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw.value}
              className={`time-btn ${timeWindow === tw.value ? 'time-btn--active' : ''}`}
              onClick={() => setTimeWindow(tw.value)}
              aria-pressed={timeWindow === tw.value}
            >
              {tw.label}
            </button>
          ))}
        </div>
      </div>

      {!series || series.length === 0 ? (
        <div className="metrics-dashboard__empty">
          <p>Select a resource to view metrics</p>
        </div>
      ) : (
        <div className="metrics-dashboard__grid">
          {series.map((s) => (
            <div key={s.name} className="metrics-dashboard__card">
              <h3 className="metrics-dashboard__card-title">{s.name}</h3>
              <TimeSeriesChart
                points={s.points}
                unit={s.unit}
                thresholdPercent={80}
              />
              {s.points.length > 0 && (
                <ResourceGauge
                  current={s.points[s.points.length - 1].value}
                  label={s.name}
                  unit={s.unit}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
