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
  healthy: '#6ccfb5',
  warning: '#e8b84a',
  critical: '#e86b73',
  unknown: '#4a5268',
};

// Colors per resource kind for visual distinction
const KIND_COLORS: Record<string, string> = {
  Node: '#8b93a7',
  Namespace: '#6d9cff',
  Deployment: '#a78bfa',
  ReplicaSet: '#818cf8',
  StatefulSet: '#c084fc',
  DaemonSet: '#e879f9',
  Service: '#f472b6',
  Pod: '#6ccfb5',
  Container: '#67e8f9',
};

// Shape drawing per kind — premium glassmorphic style
function drawNode(ctx: CanvasRenderingContext2D, node: LayoutNode, isHovered: boolean) {
  const x = node.x!;
  const y = node.y!;
  const r = node.radius;

  // Determine color
  let fillColor: string;
  if (node.kind === 'Pod') {
    fillColor = STATUS_COLORS[node.status] || STATUS_COLORS.unknown;
  } else {
    fillColor = KIND_COLORS[node.kind] || '#6d9cff';
  }

  ctx.save();

  // Outer glow (subtle, slightly more on hover)
  ctx.shadowColor = fillColor;
  ctx.shadowBlur = isHovered ? 12 : 4;
  ctx.globalAlpha = isHovered ? 1 : 0.92;

  ctx.beginPath();

  switch (node.kind) {
    case 'Node':
      roundedRect(ctx, x - r, y - r, r * 2, r * 2, 6);
      break;
    case 'Service':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet':
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
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
  }

  // Radial gradient fill (3D sphere effect)
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r * 1.2);
  grad.addColorStop(0, lightenColor(fillColor, 40));
  grad.addColorStop(0.6, fillColor);
  grad.addColorStop(1, darkenColor(fillColor, 30));
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle inner border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255,255,255,${isHovered ? 0.4 : 0.15})`;
  ctx.lineWidth = isHovered ? 2 : 1;
  ctx.stroke();

  // Kind letter
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(9, r * 0.65)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = node.kind === 'Pod' ? 'P' : node.kind === 'Service' ? 'S' : node.kind === 'Deployment' ? 'D' : node.kind === 'Node' ? 'N' : node.kind[0];
  ctx.fillText(label, x, y);

  // Name below (with background pill for readability)
  const name = truncate(node.name, 16);
  ctx.font = '10px Inter, sans-serif';
  const textWidth = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(6, 7, 11, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x - textWidth / 2 - 4, y + r + 5, textWidth + 8, 14, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(name, x, y + r + 12);

  ctx.restore();
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
  const b = Math.max(0, (num & 0x0000FF) - percent);
  return `rgb(${r},${g},${b})`;
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

      // Draw namespace swimlanes as soft gradient blobs
      const namespaceGroups = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
      for (const node of layoutNodes) {
        if (node.x == null || node.y == null || !node.namespace) continue;
        const ns = node.namespace;
        const existing = namespaceGroups.get(ns);
        const pad = node.radius + 30;
        if (existing) {
          existing.minX = Math.min(existing.minX, node.x - pad);
          existing.minY = Math.min(existing.minY, node.y - pad);
          existing.maxX = Math.max(existing.maxX, node.x + pad);
          existing.maxY = Math.max(existing.maxY, node.y + pad);
        } else {
          namespaceGroups.set(ns, {
            minX: node.x - pad,
            minY: node.y - pad,
            maxX: node.x + pad,
            maxY: node.y + pad,
          });
        }
      }

      const nsColors = [
        { fill: 'rgba(109,156,255,0.03)', border: 'rgba(109,156,255,0.12)', text: 'rgba(109,156,255,0.5)' },
        { fill: 'rgba(94,236,213,0.03)', border: 'rgba(94,236,213,0.12)', text: 'rgba(94,236,213,0.5)' },
        { fill: 'rgba(255,185,56,0.03)', border: 'rgba(255,185,56,0.12)', text: 'rgba(255,185,56,0.5)' },
        { fill: 'rgba(167,139,250,0.03)', border: 'rgba(167,139,250,0.12)', text: 'rgba(167,139,250,0.5)' },
      ];
      let nsIdx = 0;
      for (const [ns, bounds] of namespaceGroups) {
        const colors = nsColors[nsIdx % nsColors.length];
        const padding = 20;
        const x = bounds.minX - padding;
        const y = bounds.minY - padding;
        const w2 = bounds.maxX - bounds.minX + padding * 2;
        const h2 = bounds.maxY - bounds.minY + padding * 2;
        const cornerRadius = 16;

        // Soft filled background
        ctx.fillStyle = colors.fill;
        ctx.beginPath();
        ctx.roundRect(x, y, w2, h2, cornerRadius);
        ctx.fill();

        // Dashed border
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Namespace label
        ctx.fillStyle = colors.text;
        ctx.font = '600 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(ns.toUpperCase(), x + 10, y + 8);

        nsIdx++;
      }

      // Draw links as subtle curved lines
      for (const link of layoutLinks) {
        const source = link.source as LayoutNode;
        const target = link.target as LayoutNode;
        if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

        ctx.beginPath();
        // Bezier curve for organic feel
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const offset = (target.y - source.y) * 0.15;
        ctx.moveTo(source.x, source.y);
        ctx.quadraticCurveTo(midX + offset, midY - offset, target.x, target.y);

        ctx.strokeStyle = link.type === 'network'
          ? 'rgba(255, 185, 56, 0.2)'
          : 'rgba(109, 156, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
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

  // Click handling — hide tooltip when opening drawer
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingRef.current) return; // Don't click after drag
      if (!onNodeClick) return;
      const { x, y } = getLogicalCoords(e);

      const hit = layoutNodes.find((node) => {
        if (node.x == null || node.y == null) return false;
        const dx = node.x - x;
        const dy = node.y - y;
        return dx * dx + dy * dy <= (node.radius + 4) * (node.radius + 4);
      });

      if (hit) {
        setTooltip({ visible: false, x: 0, y: 0, node: null });
        setHoveredId(null);
        const resource = resources.get(hit.id);
        if (resource) onNodeClick(resource);
      }
    },
    [layoutNodes, getLogicalCoords, resources, onNodeClick]
  );

  // Zoom with wheel — cursor position as anchor point
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => {
      const newScale = Math.max(0.2, Math.min(4, t.scale * factor));
      // Zoom toward cursor: adjust x,y so the point under cursor stays fixed
      const scaleRatio = newScale / t.scale;
      const newX = mouseX - (mouseX - t.x) * scaleRatio;
      const newY = mouseY - (mouseY - t.y) * scaleRatio;
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  return (
    <div className="topology-view">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', inset: 0 }}
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
        <div className="topology-legend__group">
          <span className="topology-legend__title">Kind</span>
          <span className="topology-legend__item"><span style={{ background: KIND_COLORS.Pod, width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }} /> Pod</span>
          <span className="topology-legend__item"><span style={{ background: KIND_COLORS.Deployment, width: 10, height: 10, borderRadius: '2px', display: 'inline-block', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} /> Deploy</span>
          <span className="topology-legend__item"><span style={{ background: KIND_COLORS.Service, width: 10, height: 10, borderRadius: '2px', display: 'inline-block', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} /> Service</span>
          <span className="topology-legend__item"><span style={{ background: KIND_COLORS.Node, width: 10, height: 10, borderRadius: '3px', display: 'inline-block' }} /> Node</span>
        </div>
        <div className="topology-legend__divider" />
        <div className="topology-legend__group">
          <span className="topology-legend__title">Status</span>
          <span className="topology-legend__item"><span style={{ background: STATUS_COLORS.healthy, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> Healthy</span>
          <span className="topology-legend__item"><span style={{ background: STATUS_COLORS.warning, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> Warning</span>
          <span className="topology-legend__item"><span style={{ background: STATUS_COLORS.critical, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> Critical</span>
        </div>
      </div>
    </div>
  );
}
