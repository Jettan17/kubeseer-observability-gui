import { useEffect, useRef, useCallback } from 'react';
import { useClusterStore } from '../stores/cluster';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  reconnectMaxDelay?: number;
  heartbeatInterval?: number;
}

/**
 * WebSocket hook with automatic reconnection and heartbeat.
 */
export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    onMessage,
    reconnectMaxDelay = 30000,
    heartbeatInterval = 15000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<ConnectionState>('disconnected');

  const setConnectionStatus = useClusterStore((s) => s.setConnectionStatus);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    stateRef.current = 'connecting';
    setConnectionStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      stateRef.current = 'connected';
      setConnectionStatus('connected');
      reconnectAttemptRef.current = 0;

      // Start heartbeat
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, heartbeatInterval);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return;
        onMessage?.(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      cleanup();
      scheduleReconnect();
    };

    ws.onerror = () => {
      setConnectionStatus('error');
    };
  }, [url, onMessage, heartbeatInterval, setConnectionStatus]);

  const scheduleReconnect = useCallback(() => {
    stateRef.current = 'reconnecting';
    setConnectionStatus('connecting');

    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(1000 * Math.pow(2, attempt), reconnectMaxDelay);
    reconnectAttemptRef.current += 1;

    setTimeout(() => {
      connect();
    }, delay);
  }, [connect, reconnectMaxDelay, setConnectionStatus]);

  const cleanup = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    wsRef.current?.close();
    wsRef.current = null;
    stateRef.current = 'disconnected';
    setConnectionStatus('disconnected');
  }, [cleanup, setConnectionStatus]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { send, disconnect, state: stateRef };
}
