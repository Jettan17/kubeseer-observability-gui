import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useLogStore, LogLine } from '../../stores/logs';
import { LogSearch } from './LogSearch';

const LINE_HEIGHT = 20;
const OVERSCAN = 20;

export function LogViewer() {
  const lines = useLogStore((s) => s.lines);
  const searchQuery = useLogStore((s) => s.searchQuery);
  const levelFilter = useLogStore((s) => s.levelFilter);
  const isPinned = useLogStore((s) => s.isPinned);
  const setPinned = useLogStore((s) => s.setPinned);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  // Filter lines by level
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

  // Auto-scroll to bottom when pinned
  useEffect(() => {
    if (isPinned && containerRef.current) {
      containerRef.current.scrollTop = totalHeight;
    }
  }, [filteredLines.length, isPinned, totalHeight]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    scrollTopRef.current = el.scrollTop;

    // Unpin if user scrolls up
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - LINE_HEIGHT * 2;
    if (!atBottom && isPinned) {
      setPinned(false);
    } else if (atBottom && !isPinned) {
      setPinned(true);
    }
  }, [isPinned, setPinned]);

  // Calculate visible window
  const containerHeight = containerRef.current?.clientHeight || 600;
  const startIdx = Math.max(0, Math.floor(scrollTopRef.current / LINE_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    filteredLines.length,
    Math.ceil((scrollTopRef.current + containerHeight) / LINE_HEIGHT) + OVERSCAN
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
        style={{ height: '100%', overflow: 'auto' }}
        role="log"
        aria-label="Application logs"
        aria-live="polite"
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)`, position: 'absolute', width: '100%' }}>
            {visibleLines.map((line, i) => (
              <LogLineRow key={startIdx + i} line={line} highlight={searchQuery} />
            ))}
          </div>
        </div>
      </div>
      {!isPinned && (
        <button
          className="log-viewer__scroll-btn"
          onClick={() => setPinned(true)}
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

  return (
    <div className={`log-line ${levelClass}`} style={{ height: LINE_HEIGHT }}>
      <span className="log-line__time">{formatTimestamp(line.timestamp)}</span>
      <span className="log-line__container">{line.container}</span>
      <span className="log-line__message">
        {highlight ? highlightText(line.message, highlight) : line.message}
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
