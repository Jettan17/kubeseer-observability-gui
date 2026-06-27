import { useState } from 'react';
import { WaterfallView } from './WaterfallView';

export interface Trace {
  traceId: string;
  rootService: string;
  duration: number;
  spanCount: number;
  status: 'ok' | 'error';
  startTime: string;
}

export interface Span {
  spanId: string;
  parentSpanId?: string;
  service: string;
  operation: string;
  duration: number;
  startTime: number;
  attributes: Record<string, string>;
  events: SpanEvent[];
  status: 'ok' | 'error';
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, string>;
}

interface TraceExplorerProps {
  traces: Trace[];
  onTraceSelect?: (traceId: string) => void;
}

export function TraceExplorer({ traces, onTraceSelect }: TraceExplorerProps) {
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState('');
  const [minDuration, setMinDuration] = useState(0);

  const filteredTraces = traces.filter((t) => {
    if (serviceFilter && !t.rootService.toLowerCase().includes(serviceFilter.toLowerCase())) {
      return false;
    }
    if (minDuration && t.duration < minDuration) {
      return false;
    }
    return true;
  });

  const handleSelect = (traceId: string) => {
    setSelectedTrace(traceId);
    onTraceSelect?.(traceId);
  };

  return (
    <div className="trace-explorer">
      <div className="trace-explorer__controls" role="toolbar" aria-label="Trace filters">
        <input
          type="search"
          placeholder="Filter by service..."
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          aria-label="Filter traces by service"
        />
        <input
          type="number"
          placeholder="Min duration (ms)"
          value={minDuration || ''}
          onChange={(e) => setMinDuration(Number(e.target.value) || 0)}
          aria-label="Minimum trace duration"
          min={0}
        />
      </div>

      <div className="trace-explorer__layout">
        <div className="trace-explorer__list" role="listbox" aria-label="Trace list">
          {filteredTraces.map((trace) => (
            <button
              key={trace.traceId}
              className={`trace-item ${selectedTrace === trace.traceId ? 'trace-item--selected' : ''}`}
              onClick={() => handleSelect(trace.traceId)}
              role="option"
              aria-selected={selectedTrace === trace.traceId}
            >
              <div className="trace-item__header">
                <span className="trace-item__service">{trace.rootService}</span>
                <span className={`trace-item__status trace-item__status--${trace.status}`}>
                  {trace.status}
                </span>
              </div>
              <div className="trace-item__details">
                <span>{trace.duration.toFixed(1)}ms</span>
                <span>{trace.spanCount} spans</span>
                <span>{new Date(trace.startTime).toLocaleTimeString()}</span>
              </div>
            </button>
          ))}
          {filteredTraces.length === 0 && (
            <p className="trace-explorer__empty">No traces match filters</p>
          )}
        </div>

        {selectedTrace && (
          <div className="trace-explorer__detail">
            <WaterfallView traceId={selectedTrace} spans={[]} />
          </div>
        )}
      </div>
    </div>
  );
}
