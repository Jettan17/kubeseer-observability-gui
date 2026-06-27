import { useRef, useEffect } from 'react';
import { TimeSeriesPoint } from '../../stores/metrics';

interface TimeSeriesChartProps {
  points: TimeSeriesPoint[];
  unit: string;
  thresholdPercent?: number;
  height?: number;
}

/**
 * Lightweight canvas-based time series chart.
 * Uses direct Canvas2D for performance with large datasets.
 * (uPlot integration deferred to optimization phase)
 */
export function TimeSeriesChart({
  points,
  unit,
  thresholdPercent = 80,
  height = 150,
}: TimeSeriesChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 10, right: 10, bottom: 25, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Compute bounds
    const minTime = points[0].timestamp;
    const maxTime = points[points.length - 1].timestamp;
    const maxVal = Math.max(...points.map((p) => p.value)) * 1.1 || 1;
    const timeRange = maxTime - minTime || 1;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw threshold line
    if (thresholdPercent) {
      const thresholdY = padding.top + chartH * (1 - thresholdPercent / 100);
      ctx.strokeStyle = 'var(--status-warning, #ffbe0b)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, thresholdY);
      ctx.lineTo(padding.left + chartW, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw line
    ctx.strokeStyle = 'var(--chart-line-1, #6390ff)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < points.length; i++) {
      const x = padding.left + ((points[i].timestamp - minTime) / timeRange) * chartW;
      const y = padding.top + chartH * (1 - points[i].value / maxVal);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = 'var(--chart-fill, rgba(99, 144, 255, 0.1))';
    ctx.fill();

    // Y-axis labels
    ctx.fillStyle = 'var(--text-secondary, #9ca3b4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${maxVal.toFixed(0)} ${unit}`, padding.left - 4, padding.top + 10);
    ctx.fillText(`0`, padding.left - 4, padding.top + chartH);
  }, [points, unit, thresholdPercent, height]);

  return (
    <canvas
      ref={canvasRef}
      className="time-series-chart"
      style={{ width: '100%', height }}
      aria-label={`Time series chart showing ${unit} over time`}
      role="img"
    />
  );
}
