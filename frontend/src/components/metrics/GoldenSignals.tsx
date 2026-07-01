import { useMemo } from 'react';

interface GoldenSignalsProps {
  clusterId: string;
}

interface SignalCard {
  name: string;
  value: string;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'critical';
  sparkline: number[];
}

// Seeded random for stable signal data
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function GoldenSignals({ clusterId }: GoldenSignalsProps) {
  const signals = useMemo((): SignalCard[] => {
    const rng = seeded(hashStr(clusterId + ':signals'));

    const latencyBase = 40 + rng() * 120;
    const trafficBase = 800 + rng() * 2000;
    const errorBase = rng() * 5;
    const saturationBase = 55 + rng() * 30;

    const genSparkline = (base: number, variance: number) =>
      Array.from({ length: 20 }, (_, i) => base + Math.sin(i / 3) * variance + (rng() - 0.5) * variance * 0.5);

    return [
      {
        name: 'Latency (p99)',
        value: latencyBase.toFixed(0),
        unit: 'ms',
        trend: latencyBase > 120 ? 'up' : 'stable',
        status: latencyBase > 200 ? 'critical' : latencyBase > 100 ? 'warning' : 'healthy',
        sparkline: genSparkline(latencyBase, 30),
      },
      {
        name: 'Traffic',
        value: trafficBase.toFixed(0),
        unit: 'req/s',
        trend: 'stable',
        status: 'healthy',
        sparkline: genSparkline(trafficBase, 200),
      },
      {
        name: 'Error Rate',
        value: errorBase.toFixed(2),
        unit: '%',
        trend: errorBase > 3 ? 'up' : 'stable',
        status: errorBase > 5 ? 'critical' : errorBase > 2 ? 'warning' : 'healthy',
        sparkline: genSparkline(errorBase, 1.5),
      },
      {
        name: 'Saturation',
        value: saturationBase.toFixed(0),
        unit: '%',
        trend: saturationBase > 80 ? 'up' : 'stable',
        status: saturationBase > 85 ? 'critical' : saturationBase > 70 ? 'warning' : 'healthy',
        sparkline: genSparkline(saturationBase, 8),
      },
    ];
  }, [clusterId]);

  return (
    <div className="golden-signals">
      {signals.map((signal) => (
        <div key={signal.name} className={`golden-signal golden-signal--${signal.status}`}>
          <div className="golden-signal__header">
            <span className="golden-signal__name">{signal.name}</span>
            <span className="golden-signal__trend">
              {signal.trend === 'up' ? '↑' : signal.trend === 'down' ? '↓' : '→'}
            </span>
          </div>
          <div className="golden-signal__value">
            {signal.value}
            <span className="golden-signal__unit">{signal.unit}</span>
          </div>
          <div className="golden-signal__sparkline">
            <Sparkline data={signal.sparkline} color={
              signal.status === 'healthy' ? '#5eecd5' :
              signal.status === 'warning' ? '#ffc145' : '#ff6b6b'
            } />
          </div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 28;
  const w = 80;

  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="sparkline-svg">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
