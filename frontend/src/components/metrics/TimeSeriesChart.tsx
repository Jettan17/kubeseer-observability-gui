import { useRef, useEffect } from 'react';
import { TimeSeriesPoint } from '../../stores/metrics';

interface TimeSeriesChartProps {
  points: TimeSeriesPoint[];
  unit: string;
  thresholdPercent?: number;
  height?: number;
  color?: string;
}

/**
 * Canvas-based time series chart with proper color resolution.
 */
export function TimeSeriesChart({
  points,
  unit,
  thresholdPercent = 80,
  height = 160,
  color,
}: TimeSeriesChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resolve CSS custom properties to actual values
    const styles = getComputedStyle(canvas);
    const lineColor = color || styles.getPropertyValue('--chart-line-1').trim() || '#6d9cff';
    const fillColor = hexToRgba(lineColor, 0.08);
    const warningColor = styles.getPropertyValue('--status-warning').trim() || '#ffc145';
    const textColor = styles.getPropertyValue('--text-secondary').trim() || '#8b93a7';
    const gridColor = styles.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.04)';

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 16, right: 16, bottom: 28, left: 52 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Compute bounds
    const minTime = points[0].timestamp;
    const maxTime = points[points.length - 1].timestamp;
    const maxVal = Math.max(...points.map((p) => p.value)) * 1.15 || 1;
    const timeRange = maxTime - minTime || 1;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }

    // Draw threshold line
    if (thresholdPercent) {
      const thresholdY = padding.top + chartH * (1 - thresholdPercent / 100);
      ctx.strokeStyle = warningColor;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, thresholdY);
      ctx.lineTo(padding.left + chartW, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Draw filled area first
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    for (let i = 0; i < points.length; i++) {
      const x = padding.left + ((points[i].timestamp - minTime) / timeRange) * chartW;
      const y = padding.top + chartH * (1 - points[i].value / maxVal);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw line on top
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const x = padding.left + ((points[i].timestamp - minTime) / timeRange) * chartW;
      const y = padding.top + chartH * (1 - points[i].value / maxVal);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = textColor;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${maxVal.toFixed(0)}`, padding.left - 8, padding.top);
    ctx.fillText(`${(maxVal / 2).toFixed(0)}`, padding.left - 8, padding.top + chartH / 2);
    ctx.fillText('0', padding.left - 8, padding.top + chartH);

    // X-axis time labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const timeLabels = 5;
    for (let i = 0; i <= timeLabels; i++) {
      const t = minTime + (timeRange / timeLabels) * i;
      const x = padding.left + (chartW / timeLabels) * i;
      const date = new Date(t);
      const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(label, x, padding.top + chartH + 8);
    }

    // Unit label
    ctx.textAlign = 'left';
    ctx.fillText(unit, padding.left, padding.top + chartH + 8);
  }, [points, unit, thresholdPercent, height, color]);

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

function hexToRgba(hex: string, alpha: number): string {
  // Handle shorthand or named colors
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb(', 'rgba(');
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(109, 156, 255, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
