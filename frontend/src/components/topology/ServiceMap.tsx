import { useMemo, useRef, useEffect, useState } from 'react';

interface ServiceNode {
  id: string;
  name: string;
  requestsPerSec: number;
  errorRate: number;
  avgLatency: number;
  x?: number;
  y?: number;
}

interface ServiceEdge {
  source: string | ServiceNode;
  target: string | ServiceNode;
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
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

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

  // Hierarchical left-to-right layout (like an architecture diagram)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || 700;
    const h = canvas.clientHeight || 500;

    // Assign layers (depth from source) using BFS
    const layers: Record<string, number> = {};
    const edgeMap = new Map<string, string[]>();
    for (const e of graphData.edges) {
      const src = typeof e.source === 'string' ? e.source : (e.source as any).id;
      const tgt = typeof e.target === 'string' ? e.target : (e.target as any).id;
      if (!edgeMap.has(src)) edgeMap.set(src, []);
      edgeMap.get(src)!.push(tgt);
    }

    // BFS from api-gateway (the entry point)
    const queue = ['api-gateway'];
    layers['api-gateway'] = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      const targets = edgeMap.get(current) || [];
      for (const t of targets) {
        if (!(t in layers)) {
          layers[t] = layers[current] + 1;
          queue.push(t);
        }
      }
    }
    // Assign any unvisited nodes to the last layer
    for (const node of graphData.nodes) {
      if (!(node.id in layers)) layers[node.id] = 3;
    }

    // Position nodes in columns (layers) with even vertical spacing
    const maxLayer = Math.max(...Object.values(layers));
    const layerNodes: Record<number, ServiceNode[]> = {};
    for (const node of graphData.nodes) {
      const l = layers[node.id];
      if (!layerNodes[l]) layerNodes[l] = [];
      layerNodes[l].push(node);
    }

    const marginX = 100;
    const marginY = 60;
    const colWidth = (w - marginX * 2) / Math.max(maxLayer, 1);

    for (let layer = 0; layer <= maxLayer; layer++) {
      const nodesInLayer = layerNodes[layer] || [];
      const rowHeight = (h - marginY * 2) / Math.max(nodesInLayer.length - 1, 1);
      const offsetY = nodesInLayer.length === 1 ? h / 2 : marginY;
      nodesInLayer.forEach((node, i) => {
        node.x = marginX + layer * colWidth;
        node.y = offsetY + i * rowHeight;
      });
    }

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

      // Apply pan/zoom transform
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Draw edges with thickness based on traffic
      for (const edge of edges) {
        const srcId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const tgtId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        const source = nodes.find((n) => n.id === srcId);
        const target = nodes.find((n) => n.id === tgtId);
        if (!source?.x || !source?.y || !target?.x || !target?.y) continue;

        const thickness = Math.max(1.5, Math.min(6, edge.requestsPerSec / 300));
        const color = edge.errorRate > 3 ? 'rgba(255, 107, 107, 0.6)' :
          edge.errorRate > 1 ? 'rgba(255, 193, 69, 0.5)' : 'rgba(109, 156, 255, 0.4)';

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.stroke();

        // Arrow (filled triangle at 70% along the edge)
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        const arrowLen = 8;
        const t = 0.65;
        const ax = source.x + (target.x - source.x) * t;
        const ay = source.y + (target.y - source.y) * t;
        ctx.beginPath();
        ctx.moveTo(ax + arrowLen * Math.cos(angle), ay + arrowLen * Math.sin(angle));
        ctx.lineTo(ax + arrowLen * Math.cos(angle - 2.4), ay + arrowLen * Math.sin(angle - 2.4));
        ctx.lineTo(ax + arrowLen * Math.cos(angle + 2.4), ay + arrowLen * Math.sin(angle + 2.4));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Draw service nodes
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const r = 30;

        const fillColor = node.errorRate > 4 ? '#ff5c6c' :
          node.errorRate > 2 ? '#ffb938' : '#4aedc2';

        // Glow
        ctx.shadowColor = fillColor;
        ctx.shadowBlur = 6;

        // Gradient fill (sphere effect)
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r * 1.2);
        grad.addColorStop(0, fillColor + '40');
        grad.addColorStop(0.7, fillColor + '18');
        grad.addColorStop(1, fillColor + '08');
        ctx.fillStyle = grad;
        ctx.fill();

        // Border
        ctx.shadowBlur = 0;
        ctx.strokeStyle = fillColor + '60';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Service name
        ctx.fillStyle = '#eef1f8';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const shortName = node.name.replace('-service', '').replace('-redis', '');
        ctx.fillText(shortName, node.x, node.y - 4);

        // Requests/sec below
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = '#8892a8';
        ctx.fillText(`${node.requestsPerSec} req/s`, node.x, node.y + 10);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, transform]);

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
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', minHeight: 400, display: 'block', cursor: isDragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={(e) => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; }}
        onMouseMove={(e) => {
          if (!isDragging.current) return;
          const dx = e.clientX - lastMouse.current.x;
          const dy = e.clientY - lastMouse.current.y;
          lastMouse.current = { x: e.clientX, y: e.clientY };
          setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
        }}
        onMouseUp={() => { isDragging.current = false; }}
        onMouseLeave={() => { isDragging.current = false; }}
        onWheel={(e) => {
          e.preventDefault();
          const rect = canvasRef.current!.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const factor = e.deltaY > 0 ? 0.92 : 1.08;
          setTransform((t) => {
            const newScale = Math.max(0.3, Math.min(3, t.scale * factor));
            const ratio = newScale / t.scale;
            return { x: mouseX - (mouseX - t.x) * ratio, y: mouseY - (mouseY - t.y) * ratio, scale: newScale };
          });
        }}
      />
    </div>
  );
}
