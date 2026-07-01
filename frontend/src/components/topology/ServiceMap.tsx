import { useMemo, useRef, useEffect, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

interface ServiceNode extends SimulationNodeDatum {
  id: string;
  name: string;
  requestsPerSec: number;
  errorRate: number;
  avgLatency: number;
}

interface ServiceEdge extends SimulationLinkDatum<ServiceNode> {
  requestsPerSec: number;
  errorRate: number;
}

interface ServiceMapProps {
  clusterId: string;
}

// Seeded RNG
function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
function hashStr(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h);
}

const SERVICE_NAMES = ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'order-service', 'notification-service', 'inventory-service', 'cache-redis'];

export function ServiceMap({ clusterId }: ServiceMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<ServiceNode[]>([]);
  const [edges, setEdges] = useState<ServiceEdge[]>([]);
  const animRef = useRef(0);

  // Generate service graph deterministically
  const graphData = useMemo(() => {
    const rng = seeded(hashStr(clusterId + ':servicemap'));
    const serviceNodes: ServiceNode[] = SERVICE_NAMES.map((name) => ({
      id: name,
      name,
      requestsPerSec: Math.floor(50 + rng() * 2000),
      errorRate: rng() * 6,
      avgLatency: 10 + rng() * 200,
    }));

    // Create edges (traffic flow between services)
    const serviceEdges: ServiceEdge[] = [
      { source: 'api-gateway', target: 'auth-service', requestsPerSec: 800 + rng() * 500, errorRate: rng() * 2 },
      { source: 'api-gateway', target: 'user-service', requestsPerSec: 600 + rng() * 400, errorRate: rng() * 1 },
      { source: 'api-gateway', target: 'order-service', requestsPerSec: 400 + rng() * 300, errorRate: rng() * 3 },
      { source: 'user-service', target: 'cache-redis', requestsPerSec: 1000 + rng() * 800, errorRate: rng() * 0.5 },
      { source: 'order-service', target: 'payment-service', requestsPerSec: 200 + rng() * 200, errorRate: rng() * 5 },
      { source: 'order-service', target: 'inventory-service', requestsPerSec: 300 + rng() * 200, errorRate: rng() * 1 },
      { source: 'payment-service', target: 'notification-service', requestsPerSec: 100 + rng() * 100, errorRate: rng() * 2 },
      { source: 'auth-service', target: 'cache-redis', requestsPerSec: 500 + rng() * 300, errorRate: rng() * 0.3 },
    ];

    return { nodes: serviceNodes, edges: serviceEdges };
  }, [clusterId]);

  // Run force simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || 700;
    const h = canvas.clientHeight || 500;

    const sim = forceSimulation(graphData.nodes)
      .force('link', forceLink<ServiceNode, ServiceEdge>(graphData.edges).id((d) => d.id).distance(140).strength(0.4))
      .force('charge', forceManyBody().strength(-400))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collision', forceCollide(50));

    sim.tick(200);
    sim.stop();

    setNodes([...graphData.nodes]);
    setEdges([...graphData.edges]);
  }, [graphData]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Draw edges with thickness based on traffic
      for (const edge of edges) {
        const source = edge.source as ServiceNode;
        const target = edge.target as ServiceNode;
        if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

        const thickness = Math.max(1.5, Math.min(6, edge.requestsPerSec / 300));
        const color = edge.errorRate > 3 ? 'rgba(255, 107, 107, 0.6)' :
          edge.errorRate > 1 ? 'rgba(255, 193, 69, 0.5)' : 'rgba(109, 156, 255, 0.4)';

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.stroke();

        // Arrow
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        const arrowLen = 10;
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        ctx.beginPath();
        ctx.moveTo(midX + arrowLen * Math.cos(angle - 0.4), midY + arrowLen * Math.sin(angle - 0.4));
        ctx.lineTo(midX, midY);
        ctx.lineTo(midX + arrowLen * Math.cos(angle + 0.4), midY + arrowLen * Math.sin(angle + 0.4));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw service nodes
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const r = 28;

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        const fillColor = node.errorRate > 4 ? '#ff6b6b' :
          node.errorRate > 2 ? '#ffc145' : '#5eecd5';
        ctx.fillStyle = fillColor;
        ctx.globalAlpha = 0.15;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Service name
        ctx.fillStyle = '#f0f2f8';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const shortName = node.name.replace('-service', '').replace('-redis', '');
        ctx.fillText(shortName, node.x, node.y - 4);

        // Requests/sec below
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = '#8b93a7';
        ctx.fillText(`${node.requestsPerSec} req/s`, node.x, node.y + 10);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges]);

  return (
    <div className="service-map">
      <div className="service-map__header">
        <h3>Service Dependency Map</h3>
        <div className="service-map__legend">
          <span><span className="service-map__legend-line service-map__legend-line--healthy" /> Normal</span>
          <span><span className="service-map__legend-line service-map__legend-line--warning" /> Elevated errors</span>
          <span><span className="service-map__legend-line service-map__legend-line--critical" /> High errors</span>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', minHeight: 400, display: 'block' }} />
    </div>
  );
}
