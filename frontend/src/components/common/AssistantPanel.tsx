import { useState, useRef, useEffect, useCallback } from 'react';
import { useClusterStore } from '../../stores/cluster';
import { useLogStore } from '../../stores/logs';
import { analyze, type AnalysisContext, type AnalysisResult, type DeployEvent } from '../../lib/troubleshoot-engine';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  findings?: AnalysisResult['findings'];
  timestamp: number;
}

// Mock deploy events (in production, would come from a store)
const MOCK_DEPLOY_EVENTS: DeployEvent[] = [
  { service: 'api-gateway', action: 'rollout', detail: 'image: v2.3.1 → v2.4.0', timestamp: Date.now() - 7200000 },
  { service: 'payment-service', action: 'rollback', detail: 'rolled back to v2.3.0', timestamp: Date.now() - 14400000 },
  { service: 'order-service', action: 'scale', detail: 'replicas: 2 → 4', timestamp: Date.now() - 21600000 },
];

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistantPanel({ isOpen, onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "I can help troubleshoot your cluster. Try asking:\n• \"what is wrong\" — list all unhealthy resources\n• \"why is payment-service crashing\" — diagnose a specific resource\n• \"show errors\" — recent error logs\n• \"high memory\" — top resources by memory usage\n• \"high cpu\" — top resources by CPU usage\n• \"what changed recently\" — deployment history\n• \"is api-gateway healthy\" — check specific resource status",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resources = useClusterStore((s) => s.resources);
  const logs = useLogStore((s) => s.lines);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    // Build context from stores
    const ctx: AnalysisContext = {
      resources: Array.from(resources.values()),
      logs: logs.slice(-200),
      deployEvents: MOCK_DEPLOY_EVENTS,
    };

    // Run analysis
    const result = analyze(input.trim(), ctx);

    const assistantMsg: Message = {
      id: `assist-${Date.now()}`,
      role: 'assistant',
      content: result.summary,
      findings: result.findings,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
  }, [input, resources, logs]);

  if (!isOpen) return null;

  return (
    <div className="assistant-panel">
      <header className="assistant-panel__header">
        <div className="assistant-panel__title">
          <span className="assistant-panel__icon">⚡</span>
          <span>Troubleshoot</span>
        </div>
        <button className="assistant-panel__close" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <div className="assistant-panel__messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`assistant-msg assistant-msg--${msg.role}`}>
            <div className="assistant-msg__content">
              {msg.content.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            {msg.findings && msg.findings.length > 0 && (
              <div className="assistant-msg__findings">
                {msg.findings.map((f, i) => (
                  <div key={i} className={`assistant-finding assistant-finding--${f.severity}`}>
                    {f.resource && <span className="assistant-finding__resource">{f.resource}</span>}
                    <span className="assistant-finding__detail">{f.detail}</span>
                    {f.relatedLogs && f.relatedLogs.length > 0 && (
                      <div className="assistant-finding__logs">
                        {f.relatedLogs.map((log, j) => (
                          <code key={j}>{log}</code>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="assistant-panel__input" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your cluster..."
          aria-label="Ask a question"
        />
        <button type="submit" disabled={!input.trim()} aria-label="Send">
          →
        </button>
      </form>
    </div>
  );
}
