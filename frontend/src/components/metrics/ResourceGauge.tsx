interface ResourceGaugeProps {
  current: number;
  limit?: number;
  label: string;
  unit: string;
}

/**
 * Simple gauge showing current resource usage.
 * Changes color at 80% threshold.
 */
export function ResourceGauge({ current, limit, label, unit }: ResourceGaugeProps) {
  const percent = limit ? (current / limit) * 100 : 0;
  const isAtRisk = percent >= 80;
  const colorClass = isAtRisk ? 'gauge--warning' : 'gauge--normal';

  return (
    <div className={`resource-gauge ${colorClass}`} role="meter" aria-valuenow={current} aria-valuemin={0} aria-valuemax={limit} aria-label={`${label}: ${current} ${unit}`}>
      <div className="resource-gauge__label">{label}</div>
      <div className="resource-gauge__value">
        {formatValue(current)} {unit}
        {limit && (
          <span className="resource-gauge__limit"> / {formatValue(limit)} {unit}</span>
        )}
      </div>
      {limit && (
        <div className="resource-gauge__bar">
          <div
            className="resource-gauge__fill"
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatValue(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}G`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}
