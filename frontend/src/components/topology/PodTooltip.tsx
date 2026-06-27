import { LayoutNode } from './layout-engine';

interface PodTooltipProps {
  x: number;
  y: number;
  node: LayoutNode;
}

export function PodTooltip({ x, y, node }: PodTooltipProps) {
  return (
    <div
      className="topology-tooltip"
      style={{
        position: 'fixed',
        left: x + 12,
        top: y - 8,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
      role="tooltip"
    >
      <div className="topology-tooltip__header">
        <span className="topology-tooltip__kind">{node.kind}</span>
        <span className="topology-tooltip__name">{node.name}</span>
      </div>
      <div className="topology-tooltip__body">
        {node.namespace && (
          <div className="topology-tooltip__row">
            <span>Namespace</span>
            <span>{node.namespace}</span>
          </div>
        )}
        <div className="topology-tooltip__row">
          <span>Status</span>
          <span className={`status-badge status-badge--${node.status}`}>
            {node.status}
          </span>
        </div>
      </div>
    </div>
  );
}
