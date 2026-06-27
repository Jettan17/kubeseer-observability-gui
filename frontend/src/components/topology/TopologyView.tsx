import { useEffect, useRef, useState, useCallback } from 'react';
import { useClusterStore, ResourceNode } from '../../stores/cluster';
import {
  LayoutNode,
  LayoutLink,
  computeLayout,
  buildLinks,
  filterNodes,
} from './layout-engine';
import { PodTooltip } from './PodTooltip';

interface TopologyViewProps {
  filters?: {
    namespace?: string;
    status?: string;
    search?: string;
  };
  onNodeClick?: (node: ResourceNode) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: LayoutNode | null;
}

export function TopologyView({ filters, onNodeClick }: TopologyViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resources = useClusterStore((s) => s.resources);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [layoutLinks, setLayoutLinks] = useState<LayoutLink[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const animFrameRef = useRef<number>(0);

  // Convert resources to layout nodes
  useEffect(() => {
    const nodes: LayoutNode[] = Array.from(resources.values()).map((r) => ({
      id: r.uid,
      kind: r.kind,
      name: r.name,
      namespace: r.namespace,
      status: r.status.state,
      parentId: r.parentUid,
      radius: 12,
    }));

    const filtered = filters ? filterNodes(nodes, filters) : nodes;
    const links = buildLinks(filtered);

    const canvas = canvasRef.current;
    if (!canvas) return;

    computeLayout(filtered, links, canvas.width, canvas.height).then(
      (result) => {
        setLayoutNodes([...result.nodes]);
        setLayoutLinks([...result.links]);
      }
    );
  }, [resources, filters]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Draw links
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--border-primary') || 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (const link of layoutLinks) {
        const source = link.source as LayoutNode;
        const target = link.target as LayoutNode;
        if (source.x != null && source.y != null && target.x != null && target.y != null) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          if (link.type === 'network') {
            ctx.setLineDash([4, 4]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      // Draw nodes
      for (const node of layoutNodes) {
        if (node.x == null || node.y == null) continue;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = getNodeColor(node.status);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [layoutNodes, layoutLinks, transform]);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Hit testing for hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;

      const hit = layoutNodes.find((node) => {
        if (node.x == null || node.y == null) return false;
        const dx = node.x - x;
        const dy = node.y - y;
        return dx * dx + dy * dy <= node.radius * node.radius;
      });

      if (hit) {
        setTooltip({ visible: true, x: e.clientX, y: e.clientY, node: hit });
      } else {
        setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    },
    [layoutNodes, transform]
  );

  // Click handling
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || !onNodeClick) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;

      const hit = layoutNodes.find((node) => {
        if (node.x == null || node.y == null) return false;
        const dx = node.x - x;
        const dy = node.y - y;
        return dx * dx + dy * dy <= node.radius * node.radius;
      });

      if (hit) {
        const resource = resources.get(hit.id);
        if (resource) onNodeClick(resource);
      }
    },
    [layoutNodes, transform, resources, onNodeClick]
  );

  // Zoom with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.1, Math.min(5, t.scale * factor)),
    }));
  }, []);

  return (
    <div className="topology-view" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onWheel={handleWheel}
      />
      {tooltip.visible && tooltip.node && (
        <PodTooltip x={tooltip.x} y={tooltip.y} node={tooltip.node} />
      )}
    </div>
  );
}

function getNodeColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'var(--status-healthy, #4ecdc4)';
    case 'warning':
      return 'var(--status-warning, #ffbe0b)';
    case 'critical':
      return 'var(--status-critical, #ff5e5b)';
    default:
      return 'var(--status-unknown, #5a6178)';
  }
}
