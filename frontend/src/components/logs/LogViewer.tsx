import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useLogStore, LogLine } from '../../stores/logs';
import { useUIStore } from '../../stores/ui';
import { LogSearch } from './LogSearch';

const LINE_HEIGHT = 22;
const OVERSCAN = 30;

export function LogViewer() {
  const lines = useLogStore((s) => s.lines);
  const searchQuery = useLogStore((s) => s.searchQuery);
  const levelFilter = useLogStore((s) => s.levelFilter);
  const isPinned = useLogStore((s) => s.isPinned);
  const setPinned = useLogStore((s) => s.setPinned);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Filter lines by level and search — memoized to avoid re-computation
  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (line.level && !levelFilter.has(line.level)) return false;
      if (searchQuery) {
        return line.message.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [lines, levelFilter, searchQuery]);

  const totalHeight = filteredLines.length * LINE_HEIGHT;

  // Measure container height on mount and resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
    });
    observer.observe(el);
    setContainerHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom when pinned and new lines arrive
  useEffect(() => {
    if (isPinned && containerRef.current) {
      containerRef.current.scrollTop = totalHeight;
    }
  }, [filteredLines.length, isPinned, totalHeight]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);

    // Unpin if user scrolls up, re-pin if at bottom
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - LINE_HEIGHT * 3;
    if (!atBottom && isPinned) {
      setPinned(false);
    } else if (atBottom && !isPinned) {
      setPinned(true);
    }
  }, [isPinned, setPinned]);

  // Calculate visible window
  const startIdx = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    filteredLines.length,
    Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT) + OVERSCAN
  );
  const visibleLines = filteredLines.slice(startIdx, endIdx);
  const offsetY = startIdx * LINE_HEIGHT;

  return (
    <div className="log-viewer">
      <LogSearch />
      <div
        ref={containerRef}
        className="log-viewer__scroll"
        onScroll={handleScroll}
        role="log"
        aria-label="Application logs"
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              width: '100%',
              willChange: 'transform',
            }}
          >
            {visibleLines.map((line, i) => (
              <LogLineRow key={startIdx + i} line={line} highlight={searchQuery} />
            ))}
          </div>
        </div>
      </div>
      {!isPinned && (
        <button
          className="log-viewer__scroll-btn"
          onClick={() => {
            setPinned(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = totalHeight;
            }
          }}
          aria-label="Scroll to latest"
        >
          ↓ Latest
        </button>
      )}
    </div>
  );
}

interface LogLineRowProps {
  line: LogLine;
  highlight: string;
}

function LogLineRow({ line, highlight }: LogLineRowProps) {
  const levelClass = line.level ? `log-line--${line.level}` : '';
  const setActiveView = useUIStore((s) => s.setActiveView);

  // Detect trace IDs in message (common patterns)
  const traceIdMatch = line.message.match(/trace[_-]?id[=: ]+([a-f0-9-]{16,36})/i)
    || line.message.match(/\b([a-f0-9]{32})\b/)
    || line.message.match(/X-Trace-Id[=: ]+([a-f0-9-]+)/i);

  const handleTraceClick = (_traceId: string) => {
    // Navigate to traces view (in real app would filter to this trace)
    setActiveView('traces');
  };

  return (
    <div className={`log-line ${levelClass}`} style={{ height: LINE_HEIGHT }}>
      <span className="log-line__time">{formatTimestamp(line.timestamp)}</span>
      <span className="log-line__container">{line.container}</span>
      <span className="log-line__message">
        {highlight ? highlightText(line.message, highlight) : line.message}
        {traceIdMatch && (
          <button
            className="log-line__trace-link"
            onClick={() => handleTraceClick(traceIdMatch[1])}
            title={`View trace ${traceIdMatch[1]}`}
          >
            🔗 trace
          </button>
        )}
      </span>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toISOString().slice(11, 23);
  } catch {
    return ts.slice(0, 12);
  }
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="log-highlight">{part}</mark>
    ) : (
      part
    )
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
