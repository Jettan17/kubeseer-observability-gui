/**
 * Mock data provider for development/demo.
 * Generates realistic Kubernetes cluster data.
 */

import { ResourceNode, ClusterContext } from '../stores/cluster';
import { LogLine } from '../stores/logs';
import { MetricSeries } from '../stores/metrics';
import type { Trace } from '../components/traces/TraceExplorer';

const SERVICES = ['api-gateway', 'user-service', 'payment-service', 'notification-service', 'order-service', 'inventory-service'];
const NAMESPACES = ['production', 'staging', 'monitoring', 'kube-system'];

export function generateMockContexts(): ClusterContext[] {
  return [
    { name: 'prod-us-east-1', clusterUrl: 'https://k8s.prod-east.example.com:6443', namespace: 'production', connected: true },
    { name: 'staging-eu-west-1', clusterUrl: 'https://k8s.staging-eu.example.com:6443', namespace: 'staging', connected: true },
    { name: 'dev-local', clusterUrl: 'https://192.168.1.100:6443', namespace: 'default', connected: true },
  ];
}

export function generateMockResources(): ResourceNode[] {
  const resources: ResourceNode[] = [];
  let uid = 0;

  // Nodes
  for (let i = 0; i < 4; i++) {
    resources.push({
      uid: `node-${uid++}`,
      kind: 'Node',
      name: `ip-10-0-${i}-${100 + i}.ec2.internal`,
      status: i === 2 ? { state: 'warning', message: 'Memory pressure' } : { state: 'healthy' },
      labels: { 'node.kubernetes.io/instance-type': 'm5.xlarge', role: 'worker' },
      clusterId: 'prod-us-east-1',
    });
  }

  // Namespaces + deployments + pods
  for (const ns of NAMESPACES) {
    resources.push({
      uid: `ns-${uid++}`,
      kind: 'Namespace',
      name: ns,
      status: { state: 'healthy' },
      labels: {},
      clusterId: 'prod-us-east-1',
    });
  }

  for (const svc of SERVICES) {
    const deployUid = `deploy-${uid++}`;
    const ns = svc.includes('gateway') ? 'production' : NAMESPACES[Math.floor(Math.random() * 2)];

    resources.push({
      uid: deployUid,
      kind: 'Deployment',
      name: svc,
      namespace: ns,
      status: { state: 'healthy' },
      labels: { app: svc },
      clusterId: 'prod-us-east-1',
    });

    // Service
    resources.push({
      uid: `svc-${uid++}`,
      kind: 'Service',
      name: `${svc}-svc`,
      namespace: ns,
      status: { state: 'healthy' },
      labels: { app: svc },
      clusterId: 'prod-us-east-1',
    });

    // Pods (2-4 per deployment)
    const podCount = 2 + Math.floor(Math.random() * 3);
    for (let p = 0; p < podCount; p++) {
      const hash = Math.random().toString(36).substring(2, 7);
      const isCrashing = svc === 'payment-service' && p === 0;
      const isPending = svc === 'notification-service' && p === 1;

      resources.push({
        uid: `pod-${uid++}`,
        kind: 'Pod',
        name: `${svc}-${hash}`,
        namespace: ns,
        status: isCrashing
          ? { state: 'critical', message: 'CrashLoopBackOff' }
          : isPending
          ? { state: 'warning', message: 'Pending - Insufficient memory' }
          : { state: 'healthy' },
        labels: { app: svc, 'pod-template-hash': hash },
        parentUid: deployUid,
        clusterId: 'prod-us-east-1',
        restartCount: isCrashing ? 12 : 0,
        ageSeconds: Math.floor(Math.random() * 86400 * 7),
        metrics: {
          cpuUsageMillicores: Math.floor(Math.random() * 800),
          cpuLimitMillicores: 1000,
          memoryUsageBytes: Math.floor(Math.random() * 512 * 1024 * 1024),
          memoryLimitBytes: 512 * 1024 * 1024,
        },
      });
    }
  }

  return resources;
}

export function generateMockLogs(count = 200): LogLine[] {
  const messages = [
    'Handling request GET /api/v1/users',
    'Database query completed in 23ms',
    'Cache hit for key user:1234',
    'WebSocket connection established from 10.0.1.45',
    'Processing payment for order #8821',
    'Sent notification email to user@example.com',
    'Health check passed',
    'Connection pool: 12/50 active',
    'Rate limiter: 450/1000 requests this window',
    'JWT token validated for user abc-123',
    'gRPC call to inventory-service: 15ms',
    'Metrics exported: 342 data points',
    'ERROR: Connection refused to redis:6379',
    'WARN: Slow query detected (>500ms): SELECT * FROM orders WHERE...',
    'ERROR: OOM killed - container exceeded 512Mi limit',
    'WARN: Certificate expires in 14 days',
    'Retry attempt 2/3 for upstream payment-gateway',
    'ERROR: Unhandled exception in handler: NullPointerException',
    'DEBUG: Goroutine count: 1247',
    'Graceful shutdown initiated, draining connections...',
    'Request completed trace_id=4a3b2c1d5e6f7a8b9c0d1e2f3a4b5c6d duration=142ms',
    'Span started trace_id=7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c service=payment-service',
    'ERROR: Timeout waiting for response trace_id=1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
  ];

  const containers = ['api-gateway', 'user-service', 'payment-service', 'envoy-proxy', 'fluent-bit'];
  const levels: LogLine['level'][] = ['info', 'info', 'info', 'info', 'warn', 'error', 'debug'];

  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const msg = messages[Math.floor(Math.random() * messages.length)];
    const level = msg.startsWith('ERROR') ? 'error' : msg.startsWith('WARN') ? 'warn' : msg.startsWith('DEBUG') ? 'debug' : levels[Math.floor(Math.random() * levels.length)];
    return {
      timestamp: new Date(now - (count - i) * 1500).toISOString(),
      container: containers[Math.floor(Math.random() * containers.length)],
      level,
      message: msg,
    };
  });
}

export function generateMockMetrics(): MetricSeries[] {
  const now = Date.now();
  const points = 120; // 30 min at 15s intervals

  function genPoints(base: number, variance: number) {
    return Array.from({ length: points }, (_, i) => ({
      timestamp: now - (points - i) * 15000,
      value: base + (Math.sin(i / 10) * variance) + (Math.random() * variance * 0.3),
    }));
  }

  return [
    { name: 'CPU Usage', unit: 'millicores', points: genPoints(350, 150) },
    { name: 'Memory Usage', unit: 'MiB', points: genPoints(380, 50) },
    { name: 'Network RX', unit: 'KB/s', points: genPoints(200, 80) },
    { name: 'Network TX', unit: 'KB/s', points: genPoints(150, 60) },
  ];
}

export function generateMockTraces(): Trace[] {
  const now = Date.now();
  return Array.from({ length: 50 }, (_, i) => ({
    traceId: `trace-${Math.random().toString(36).substring(2, 18)}`,
    rootService: SERVICES[Math.floor(Math.random() * SERVICES.length)],
    duration: 20 + Math.random() * 800,
    spanCount: 3 + Math.floor(Math.random() * 15),
    status: (Math.random() > 0.85 ? 'error' : 'ok') as 'ok' | 'error',
    startTime: new Date(now - i * 30000 - Math.random() * 10000).toISOString(),
  }));
}
