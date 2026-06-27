import { useState } from 'react';
import { Span } from './TraceExplorer';

interface WaterfallViewProps {
  traceId: string;
  spans: Span[];
  p95Threshold?: number;
}

export function WaterfallView({ traceId: _traceId, spans, p95Threshold }: WaterfallViewProps) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  if (spans.length === 0) {
    return <div className="waterfall-empty">Loading trace spans...</div>;
  }

  // Compute trace bounds
  const minStart = Math.min(...spans.map((s) => s.startTime));
  const maxEnd = Math.max(...spans.map((s) => s.startTime + s.duration));
  const totalDuration = maxEnd - minStart || 1;

  // Build span tree (sorted by start time)
  const sortedSpans = [...spans].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="waterfall-view">
      <div className="waterfall-view__header">
        <span>Service / Operation</span>
        <span>Duration</span>
      </div>
      <div className="waterfall-view__spans" role="list">
        {sortedSpans.map((span) => {
          const left = ((span.startTime - minStart) / totalDuration) * 100;
          const width = Math.max((span.duration / totalDuration) * 100, 0.5);
          const isBottleneck = p95Threshold && span.duration > p95Threshold;

          return (
            <button
              key={span.spanId}
              className={`waterfall-span ${isBottleneck ? 'waterfall-span--bottleneck' : ''} ${
                selectedSpan?.spanId === span.spanId ? 'waterfall-span--selected' : ''
              }`}
              onClick={() => setSelectedSpan(span)}
              role="listitem"
              aria-label={`${span.service} ${span.operation} ${span.duration.toFixed(1)}ms`}
            >
              <div className="waterfall-span__label">
                <span className="waterfall-span__service">{span.service}</span>
                <span className="waterfall-span__operation">{span.operation}</span>
              </div>
              <div className="waterfall-span__bar-container">
                <div
                  className={`waterfall-span__bar waterfall-span__bar--${span.status}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <div className="waterfall-span__duration">
                {span.duration.toFixed(1)}ms
              </div>
            </button>
          );
        })}
      </div>

      {selectedSpan && (
        <SpanDetail span={selectedSpan} onClose={() => setSelectedSpan(null)} />
      )}
    </div>
  );
}

interface SpanDetailProps {
  span: Span;
  onClose: () => void;
}

function SpanDetail({ span, onClose }: SpanDetailProps) {
  return (
    <div className="span-detail" role="dialog" aria-label="Span details">
      <div className="span-detail__header">
        <h3>{span.service} — {span.operation}</h3>
        <button onClick={onClose} aria-label="Close span details">✕</button>
      </div>
      <div className="span-detail__body">
        <dl>
          <dt>Span ID</dt>
          <dd>{span.spanId}</dd>
          <dt>Duration</dt>
          <dd>{span.duration.toFixed(2)}ms</dd>
          <dt>Status</dt>
          <dd className={`status-badge status-badge--${span.status}`}>{span.status}</dd>
          {span.parentSpanId && (
            <>
              <dt>Parent Span</dt>
              <dd>{span.parentSpanId}</dd>
            </>
          )}
        </dl>

        {Object.keys(span.attributes).length > 0 && (
          <div className="span-detail__section">
            <h4>Attributes</h4>
            <dl>
              {Object.entries(span.attributes).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {span.events.length > 0 && (
          <div className="span-detail__section">
            <h4>Events</h4>
            <ul>
              {span.events.map((event, i) => (
                <li key={i}>
                  <strong>{event.name}</strong> at {event.timestamp.toFixed(2)}ms
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
