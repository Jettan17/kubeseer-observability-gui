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

// Concrete colors for canvas (CSS vars don't work in canvas context)
const STATUS_COLORS: Record<string, string> = {
  healthy: '#5eecd5',
  warning: '#ffc145',
  critical: '#ff6b6b',
  unknown: '#4e5567',
};

// Colors per resource kind for visual distinction
const KIND_COLORS: Record<string, string> = {
  Node: '#8b93a7',
  Namespace: '#6d9cff',
  Deployment: '#a78bfa',
  ReplicaSet: '#818cf8',
  StatefulSet: '#c084fc',
  DaemonSet: '#e879f9',
  Service: '#fbbf24',
  Pod: '#5eecd5',
  Container: '#67e8f9',
};

// Shape drawing per kind
function drawNode(ctx: CanvasRenderingContext2D, node: LayoutNode, isHovered: boolean) {
  const x = node.x!;
  const y = node.y!;
  const r = node.radius;

  // Determine color: use status color for pods, kind color for others
  let fillColor: string;
  if (node.kind === 'Pod') {
    fillColor = STATUS_COLORS[node.status] || STATUS_COLORS.unknown;
  } else {
    fillColor = KIND_COLORS[node.kind] || '#6d9cff';
  }

  ctx.save();

  // Glow for hovered or critical
  if (isHovered || node.status === 'critical') {
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = isHovered ? 16 : 8;
  }

  ctx.beginPath();

  switch (node.kind) {
    case 'Node':
      // Rounded square
      roundedRect(ctx, x - r, y - r, r * 2, r * 2, 5);
      break;
    case 'Service':
      // Diamond
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet':
      // Hexagon
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    default:
      // Circle for Pods and everything else
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
  }

  ctx.fillStyle = fillColor;
  ctx.globalAlpha = isHovered ? 1 : 0.85;
  ctx.fill();

  // Border
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = isHovered ? 2 : 1;
  ctx.stroke();

  // Label (kind icon or first letter)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(8, r * 0.7)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = node.kind === 'Pod' ? 'P' : node.kind === 'Service' ? 'S' : node.kind === 'Deployment' ? 'D' : node.kind === 'Node' ? 'N' : node.kind[0];
  ctx.fillText(label, x, y);

  // Name below
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(truncate(node.name, 14), x, y + r + 12);

  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function TopologyView({ filters, onNodeClick }: TopologyViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resources = useClusterStore((s) => s.resources);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [layoutLinks, setLayoutLinks] = useState<LayoutLink[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const animFrameRef = useRef<number>(0);
  const dprRef = useRef(window.devicePixelRatio || 1);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Convert resources to layout nodes and compute layout
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

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;

    computeLayout(filtered, links, w, h).then((result) => {
      setLayoutNodes([...result.nodes]);
      setLayoutLinks([...result.links]);
    });
  }, [resources, filters]);

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = dprRef.current;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Ensure canvas pixel size matches
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply DPR scaling + user transform
      ctx.setTransform(
        transform.scale * dpr,
        0,
        0,
        transform.scale * dpr,
        transform.x * dpr,
        transform.y * dpr
      );

      // Draw links
      for (const link of layoutLinks) {
        const source = link.source as LayoutNode;
        const target = link.target as LayoutNode;
        if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = 'rgba(109, 156, 255, 0.2)';
        ctx.lineWidth = 1.5;
        if (link.type === 'network') {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = 'rgba(255, 193, 69, 0.25)';
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const node of layoutNodes) {
        if (node.x == null || node.y == null) continue;
        drawNode(ctx, node, node.id === hoveredId);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [layoutNodes, layoutLinks, transform, hoveredId]);

  // Convert mouse event to canvas logical coords
  const getLogicalCoords = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      // Mouse position relative to canvas element (CSS pixels)
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      // Convert to logical coords (undo transform)
      const x = (mouseX - transform.x) / transform.scale;
      const y = (mouseY - transform.y) / transform.scale;
      return { x, y };
    },
    [transform]
  );

  // Hit testing for hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle panning
      if (isDraggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
        return;
      }

      const { x, y } = getLogicalCoords(e);

      const hit = layoutNodes.find((node) => {
        if (node.x == null || node.y == null) return false;
        const dx = node.x - x;
        const dy = node.y - y;
        return dx * dx + dy * dy <= (node.radius + 4) * (node.radius + 4);
      });

      if (hit) {
        setHoveredId(hit.id);
        setTooltip({ visible: true, x: e.clientX, y: e.clientY, node: hit });
      } else {
        setHoveredId(null);
        setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    },
    [layoutNodes, getLogicalCoords]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Click handling
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onNodeClick) return;
      const { x, y } = getLogicalCoords(e);

      const hit = layoutNodes.find((node) => {
        if (node.x == null || node.y == null) return false;
        const dx = node.x - x;
        const dy = node.y - y;
        return dx * dx + dy * dy <= (node.radius + 4) * (node.radius + 4);
      });

      if (hit) {
        const resource = resources.get(hit.id);
        if (resource) onNodeClick(resource);
      }
    },
    [layoutNodes, getLogicalCoords, resources, onNodeClick]
  );

  // Zoom with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.2, Math.min(4, t.scale * factor)),
    }));
  }, []);

  return (
    <div className="topology-view">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />
      {tooltip.visible && tooltip.node && (
        <PodTooltip x={tooltip.x} y={tooltip.y} node={tooltip.node} />
      )}
      <div className="topology-legend">
        <span className="topology-legend__item"><span style={{ background: KIND_COLORS.Pod, width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }} /> Pod</span>
        <span className="topology-legend__item"><span style={{ background: KIND_COLORS.Deployment, width: 10, height: 10, borderRadius: '2px', display: 'inline-block', transform: 'rotate(45deg)' }} /> Deploy</span>
        <span className="topology-legend__item"><span style={{ background: KIND_COLORS.Service, width: 10, height: 10, borderRadius: '2px', display: 'inline-block', transform: 'rotate(45deg)' }} /> Service</span>
        <span className="topology-legend__item"><span style={{ background: KIND_COLORS.Node, width: 10, height: 10, borderRadius: '3px', display: 'inline-block' }} /> Node</span>
      </div>
    </div>
  );
}
