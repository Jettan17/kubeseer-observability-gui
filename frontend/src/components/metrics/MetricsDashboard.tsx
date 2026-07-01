import { useMemo } from 'react';
import { useMetricsStore, TimeWindow } from '../../stores/metrics';
import { TimeSeriesChart } from './TimeSeriesChart';
import { ResourceGauge } from './ResourceGauge';
import { GoldenSignals } from './GoldenSignals';
import { DeploymentTimeline } from './DeploymentTimeline';
import { getMetricsForWindow } from '../../lib/mock-metrics-store';

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

const CHART_COLORS = ['#6d9cff', '#5eecd5', '#ffc145', '#ff6b6b'];

export function MetricsDashboard({ resourceUid }: MetricsDashboardProps) {
  const timeWindow = useMetricsStore((s) => s.timeWindow);
  const setTimeWindow = useMetricsStore((s) => s.setTimeWindow);

  // Get stable metrics data — sliced from pre-generated 7-day dataset
  const series = useMemo(() => {
    if (!resourceUid) return [];
    return getMetricsForWindow(resourceUid, timeWindow);
  }, [resourceUid, timeWindow]);

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

      {series.length === 0 ? (
        <div className="metrics-dashboard__empty">
          <p>Select a resource to view metrics</p>
        </div>
      ) : (
        <>
          <GoldenSignals clusterId={resourceUid || 'default'} timeWindow={timeWindow} />
          <div className="metrics-dashboard__grid">
          {series.map((s, i) => (
            <div key={s.name} className="metrics-dashboard__card">
              <h3 className="metrics-dashboard__card-title">{s.name}</h3>
              <TimeSeriesChart
                points={s.points}
                unit={s.unit}
                thresholdPercent={80}
                color={CHART_COLORS[i % CHART_COLORS.length]}
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
          <DeploymentTimeline clusterId={resourceUid || 'default'} />
        </>
      )}
    </div>
  );
}
