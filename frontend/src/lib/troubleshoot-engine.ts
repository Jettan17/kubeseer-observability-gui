/**
 * Rule-based troubleshooting engine.
 * 
 * Correlates data from cluster stores to answer operational questions.
 * No LLM required — purely deterministic pattern matching + data lookup.
 */

import type { ResourceNode } from '../stores/cluster';
import type { LogLine } from '../stores/logs';

export interface AnalysisContext {
  resources: ResourceNode[];
  logs: LogLine[];
  deployEvents: DeployEvent[];
}

export interface DeployEvent {
  service: string;
  action: string;
  detail: string;
  timestamp: number;
}

export interface Finding {
  resource?: string;
  severity: 'info' | 'warning' | 'critical';
  detail: string;
  relatedLogs?: string[];
}

export interface AnalysisResult {
  summary: string;
  findings: Finding[];
  intent: string;
}

type Intent =
  | { type: 'diagnose'; target: string }
  | { type: 'health_check' }
  | { type: 'resource_usage'; metric: 'cpu' | 'memory' }
  | { type: 'show_errors' }
  | { type: 'what_changed' }
  | { type: 'check_health'; target: string }
  | { type: 'unknown' };

/**
 * Main entry point: analyze a natural-language question given current context.
 */
export function analyze(question: string, ctx: AnalysisContext): AnalysisResult {
  const intent = parseIntent(question);

  switch (intent.type) {
    case 'diagnose':
      return diagnosePod(intent.target, ctx);
    case 'health_check':
      return healthCheck(ctx);
    case 'resource_usage':
      return resourceUsage(intent.metric, ctx);
    case 'show_errors':
      return showErrors(ctx);
    case 'what_changed':
      return whatChanged(ctx);
    case 'check_health':
      return checkSpecificHealth(intent.target, ctx);
    default:
      return {
        summary: "I can help with cluster troubleshooting. Try asking: 'what is wrong', 'why is X crashing', 'show errors', 'high memory', or 'what changed'.",
        findings: [],
        intent: 'unknown',
      };
  }
}

/**
 * Parse user question into a structured intent.
 */
function parseIntent(q: string): Intent {
  const lower = q.toLowerCase().trim();

  // "why is X crashing/failing/restarting"
  const diagnoseMatch = lower.match(/(?:why|what's wrong with|diagnose)\s+(?:is\s+)?(.+?)(?:\s+(?:crash|fail|restart|down|broken|not working))/);
  if (diagnoseMatch) {
    return { type: 'diagnose', target: diagnoseMatch[1].trim() };
  }

  // "is X healthy/ok/running"
  const healthMatch = lower.match(/(?:is|check|status of)\s+(.+?)(?:\s+(?:healthy|ok|running|up|alive))?$/);
  if (healthMatch && (lower.includes('healthy') || lower.includes('ok') || lower.includes('status') || lower.includes('check'))) {
    return { type: 'check_health', target: healthMatch[1].replace(/\s*(healthy|ok|running|up|alive)\s*$/, '').trim() };
  }

  // "what is wrong" / "what's broken" / "issues"
  if (/what.*(wrong|broken|issue|problem)|show.*(issue|problem)|cluster.*(health|status)/.test(lower)) {
    return { type: 'health_check' };
  }

  // "high memory/cpu" / "which pods use memory"
  if (/(?:high|top|most)\s*(?:memory|mem|ram)|memory\s*(?:usage|hog|pressure)/.test(lower)) {
    return { type: 'resource_usage', metric: 'memory' };
  }
  if (/(?:high|top|most)\s*(?:cpu)|cpu\s*(?:usage|hog|pressure)/.test(lower)) {
    return { type: 'resource_usage', metric: 'cpu' };
  }

  // "show errors" / "error logs" / "what errors"
  if (/(?:show|list|get|recent)\s*(?:me\s*)?error|error\s*(?:log|message)/.test(lower)) {
    return { type: 'show_errors' };
  }

  // "what changed" / "recent deployments" / "what happened"
  if (/what\s*(?:changed|happened)|recent\s*(?:deploy|change|event)|deploy\s*(?:history|timeline)/.test(lower)) {
    return { type: 'what_changed' };
  }

  return { type: 'unknown' };
}

// --- Intent handlers ---

function diagnosePod(target: string, ctx: AnalysisContext): AnalysisResult {
  const matching = ctx.resources.filter((r) =>
    r.name.toLowerCase().includes(target.toLowerCase()) ||
    (r.labels.app && r.labels.app.toLowerCase().includes(target.toLowerCase()))
  );

  if (matching.length === 0) {
    return {
      summary: `No resources found matching "${target}".`,
      findings: [],
      intent: 'diagnose',
    };
  }

  const findings: Finding[] = matching
    .filter((r) => r.status.state !== 'healthy')
    .map((r) => {
      const relatedLogs = findRelatedLogs(r, ctx.logs);
      const message = 'message' in r.status ? (r.status as any).message : r.status.state;
      return {
        resource: r.name,
        severity: r.status.state as 'warning' | 'critical',
        detail: `Status: ${message}. Restarts: ${r.restartCount ?? 0}. Age: ${formatAge(r.ageSeconds)}.`,
        relatedLogs: relatedLogs.map((l) => l.message),
      };
    });

  // If all healthy, report that
  if (findings.length === 0) {
    findings.push({
      resource: matching[0].name,
      severity: 'info',
      detail: `${target} appears healthy. ${matching.length} resource(s) found, all running normally.`,
    });
  }

  const summary = findings.length > 0 && findings[0].severity !== 'info'
    ? `Found ${findings.length} issue(s) with "${target}".`
    : `"${target}" looks healthy.`;

  return { summary, findings, intent: 'diagnose' };
}

function healthCheck(ctx: AnalysisContext): AnalysisResult {
  const unhealthy = ctx.resources.filter((r) => r.status.state !== 'healthy');

  if (unhealthy.length === 0) {
    return {
      summary: 'All resources are healthy. No issues detected.',
      findings: [],
      intent: 'health_check',
    };
  }

  const findings: Finding[] = unhealthy.map((r) => ({
    resource: r.name,
    severity: r.status.state as 'warning' | 'critical',
    detail: `${r.kind} in ${r.namespace || 'cluster'}: ${'message' in r.status ? (r.status as any).message : r.status.state}`,
  }));

  return {
    summary: `${unhealthy.length} resource(s) with issues: ${unhealthy.filter(r => r.status.state === 'critical').length} critical, ${unhealthy.filter(r => r.status.state === 'warning').length} warning.`,
    findings,
    intent: 'health_check',
  };
}

function resourceUsage(metric: 'cpu' | 'memory', ctx: AnalysisContext): AnalysisResult {
  const withMetrics = ctx.resources.filter((r) => r.metrics);

  if (withMetrics.length === 0) {
    return { summary: 'No resource metrics available.', findings: [], intent: 'resource_usage' };
  }

  const sorted = [...withMetrics].sort((a, b) => {
    if (metric === 'memory') {
      return (b.metrics!.memoryUsageBytes || 0) - (a.metrics!.memoryUsageBytes || 0);
    }
    return (b.metrics!.cpuUsageMillicores || 0) - (a.metrics!.cpuUsageMillicores || 0);
  });

  const top5 = sorted.slice(0, 5);
  const findings: Finding[] = top5.map((r) => {
    const usage = metric === 'memory'
      ? r.metrics!.memoryUsageBytes
      : r.metrics!.cpuUsageMillicores;
    const limit = metric === 'memory'
      ? r.metrics!.memoryLimitBytes
      : r.metrics!.cpuLimitMillicores;
    const pct = limit ? Math.round((usage / limit) * 100) : 0;
    const severity: Finding['severity'] = pct > 85 ? 'critical' : pct > 70 ? 'warning' : 'info';

    const formatted = metric === 'memory'
      ? `${Math.round(usage / 1024 / 1024)}Mi / ${limit ? Math.round(limit / 1024 / 1024) + 'Mi' : '?'} (${pct}%)`
      : `${usage}m / ${limit || '?'}m (${pct}%)`;

    return {
      resource: r.name,
      severity,
      detail: `${metric === 'memory' ? 'Memory' : 'CPU'}: ${formatted}`,
    };
  });

  return {
    summary: `Top ${top5.length} resources by ${metric} usage:`,
    findings,
    intent: 'resource_usage',
  };
}

function showErrors(ctx: AnalysisContext): AnalysisResult {
  const errors = ctx.logs.filter((l) => l.level === 'error');
  const recent = errors.slice(-20);

  if (recent.length === 0) {
    return { summary: 'No error logs found.', findings: [], intent: 'show_errors' };
  }

  const findings: Finding[] = recent.map((l) => ({
    severity: 'critical' as const,
    detail: l.message,
    resource: l.container,
  }));

  return {
    summary: `${errors.length} error(s) in logs. Showing most recent ${recent.length}:`,
    findings,
    intent: 'show_errors',
  };
}

function whatChanged(ctx: AnalysisContext): AnalysisResult {
  if (ctx.deployEvents.length === 0) {
    return { summary: 'No recent deployment events found.', findings: [], intent: 'what_changed' };
  }

  const sorted = [...ctx.deployEvents].sort((a, b) => b.timestamp - a.timestamp);
  const findings: Finding[] = sorted.map((e) => ({
    resource: e.service,
    severity: e.action === 'rollback' ? 'warning' as const : 'info' as const,
    detail: `${e.action}: ${e.detail} (${formatAgo(e.timestamp)})`,
  }));

  return {
    summary: `${sorted.length} recent deployment event(s):`,
    findings,
    intent: 'what_changed',
  };
}

function checkSpecificHealth(target: string, ctx: AnalysisContext): AnalysisResult {
  const matching = ctx.resources.filter((r) =>
    r.name.toLowerCase().includes(target.toLowerCase()) ||
    (r.labels.app && r.labels.app.toLowerCase().includes(target.toLowerCase()))
  );

  if (matching.length === 0) {
    return { summary: `No resources found matching "${target}".`, findings: [], intent: 'check_health' };
  }

  const findings: Finding[] = matching.map((r) => ({
    resource: r.name,
    severity: r.status.state === 'healthy' ? 'info' as const : r.status.state as 'warning' | 'critical',
    detail: `Status: ${r.status.state}${'message' in r.status ? ' — ' + (r.status as any).message : ''}. Restarts: ${r.restartCount ?? 0}.`,
  }));

  const allHealthy = matching.every((r) => r.status.state === 'healthy');
  return {
    summary: allHealthy ? `"${target}" is healthy (${matching.length} resource(s)).` : `"${target}" has issues.`,
    findings,
    intent: 'check_health',
  };
}

// --- Helpers ---

function findRelatedLogs(resource: ResourceNode, logs: LogLine[]): LogLine[] {
  const name = resource.name.toLowerCase();
  const app = resource.labels.app?.toLowerCase() || '';
  return logs
    .filter((l) => l.level === 'error' && (
      l.container.toLowerCase().includes(app) ||
      l.message.toLowerCase().includes(name) ||
      l.message.toLowerCase().includes(app)
    ))
    .slice(-5);
}

function formatAge(seconds?: number): string {
  if (!seconds) return 'unknown';
  if (seconds > 86400) return `${Math.floor(seconds / 86400)}d`;
  if (seconds > 3600) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 60)}m`;
}

function formatAgo(timestamp: number): string {
  const ago = Date.now() - timestamp;
  if (ago < 3600000) return `${Math.floor(ago / 60000)}m ago`;
  if (ago < 86400000) return `${Math.floor(ago / 3600000)}h ago`;
  return `${Math.floor(ago / 86400000)}d ago`;
}
