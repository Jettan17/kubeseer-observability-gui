interface HealthBarProps {
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  onClick?: (status: string) => void;
}

/**
 * Health summary bar showing counts of resources by status.
 */
export function HealthBar({ healthy, warning, critical, unknown, onClick }: HealthBarProps) {
  const total = healthy + warning + critical + unknown;

  return (
    <div className="health-bar" role="status" aria-label="Cluster health summary">
      <button
        className="health-bar__segment health-bar__segment--healthy"
        onClick={() => onClick?.('healthy')}
        aria-label={`${healthy} healthy resources`}
        title={`${healthy} healthy`}
      >
        <span className="health-bar__dot" />
        <span className="health-bar__count">{healthy}</span>
      </button>
      <button
        className="health-bar__segment health-bar__segment--warning"
        onClick={() => onClick?.('warning')}
        aria-label={`${warning} warning resources`}
        title={`${warning} warning`}
      >
        <span className="health-bar__dot" />
        <span className="health-bar__count">{warning}</span>
      </button>
      <button
        className="health-bar__segment health-bar__segment--critical"
        onClick={() => onClick?.('critical')}
        aria-label={`${critical} critical resources`}
        title={`${critical} critical`}
      >
        <span className="health-bar__dot" />
        <span className="health-bar__count">{critical}</span>
      </button>
      {unknown > 0 && (
        <button
          className="health-bar__segment health-bar__segment--unknown"
          onClick={() => onClick?.('unknown')}
          aria-label={`${unknown} unknown resources`}
          title={`${unknown} unknown`}
        >
          <span className="health-bar__dot" />
          <span className="health-bar__count">{unknown}</span>
        </button>
      )}
      <span className="health-bar__total" aria-hidden="true">
        {total} total
      </span>
    </div>
  );
}
