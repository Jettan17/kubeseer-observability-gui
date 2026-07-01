/**
 * Force-directed layout engine for cluster topology.
 * Uses d3-force to compute node positions, running in main thread
 * (Web Worker implementation deferred to optimization phase).
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';

export interface LayoutNode extends SimulationNodeDatum {
  id: string;
  kind: string;
  name: string;
  namespace?: string;
  status: string;
  parentId?: string;
  radius: number;
}

export interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  type: 'ownership' | 'network' | 'selection';
}

export interface LayoutResult {
  nodes: LayoutNode[];
  links: LayoutLink[];
}

const KIND_RADIUS: Record<string, number> = {
  Node: 30,
  Namespace: 25,
  Deployment: 20,
  ReplicaSet: 16,
  StatefulSet: 20,
  DaemonSet: 20,
  Service: 18,
  Pod: 12,
  Container: 8,
};

/**
 * Compute layout positions for a set of resource nodes.
 */
export function computeLayout(
  nodes: LayoutNode[],
  links: LayoutLink[],
  width: number,
  height: number,
  onTick?: (nodes: LayoutNode[]) => void
): Promise<LayoutResult> {
  return new Promise((resolve) => {
    // Assign radii based on kind
    nodes.forEach((node) => {
      node.radius = KIND_RADIUS[node.kind] || 14;
    });

    // Custom namespace clustering force — pulls same-namespace nodes together
    function namespaceForce(alpha: number) {
      const namespaceCenters = new Map<string, { x: number; y: number; count: number }>();

      // Compute namespace centers
      for (const node of nodes) {
        if (!node.namespace || node.x == null || node.y == null) continue;
        const center = namespaceCenters.get(node.namespace) || { x: 0, y: 0, count: 0 };
        center.x += node.x;
        center.y += node.y;
        center.count++;
        namespaceCenters.set(node.namespace, center);
      }

      // Resolve centers
      const resolvedCenters = new Map<string, { x: number; y: number }>();
      for (const [ns, c] of namespaceCenters) {
        resolvedCenters.set(ns, { x: c.x / c.count, y: c.y / c.count });
      }

      // Pull nodes toward their namespace center
      for (const node of nodes) {
        if (!node.namespace || node.x == null || node.y == null) continue;
        const center = resolvedCenters.get(node.namespace);
        if (!center) continue;
        node.vx = (node.vx || 0) + (center.x - node.x) * alpha * 0.15;
        node.vy = (node.vy || 0) + (center.y - node.y) * alpha * 0.15;
      }

      // Inter-namespace repulsion: push namespace centers apart
      const nsList = Array.from(resolvedCenters.entries());
      for (let i = 0; i < nsList.length; i++) {
        for (let j = i + 1; j < nsList.length; j++) {
          const [nsA, cA] = nsList[i];
          const [nsB, cB] = nsList[j];
          const dx = cA.x - cB.x;
          const dy = cA.y - cB.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = 200; // minimum gap between namespace centers

          if (dist < minDist) {
            const force = (minDist - dist) / dist * alpha * 0.8;
            const fx = dx * force;
            const fy = dy * force;

            // Apply to all nodes in each namespace
            for (const node of nodes) {
              if (node.namespace === nsA) {
                node.vx = (node.vx || 0) + fx;
                node.vy = (node.vy || 0) + fy;
              } else if (node.namespace === nsB) {
                node.vx = (node.vx || 0) - fx;
                node.vy = (node.vy || 0) - fy;
              }
            }
          }
        }
      }
    }

    const simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink<LayoutNode, LayoutLink>(links)
          .id((d) => d.id)
          .distance((link) => {
            switch (link.type) {
              case 'ownership':
                return 60;
              case 'network':
                return 120;
              default:
                return 80;
            }
          })
          .strength(0.5)
      )
      .force('charge', forceManyBody<LayoutNode>().strength((d) => d.namespace ? -350 : -50).distanceMax(350))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collision',
        forceCollide<LayoutNode>()
          .radius((d) => d.radius + 10)
          .strength(0.9)
      )
      .force('namespace', () => namespaceForce(simulation.alpha()))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    if (onTick) {
      simulation.on('tick', () => onTick(nodes));
    }

    simulation.on('end', () => {
      resolve({ nodes, links });
    });

    // For immediate results (no animation), run synchronously
    simulation.tick(300);
    simulation.stop();

    // Post-layout: align hierarchy nodes (Node, Namespace) along the top
    const hierarchyNodes = nodes.filter((n) => n.kind === 'Node' || n.kind === 'Namespace');
    if (hierarchyNodes.length > 0) {
      const topY = 50;
      const spacing = width / (hierarchyNodes.length + 1);
      hierarchyNodes.forEach((node, i) => {
        node.x = spacing * (i + 1);
        node.y = topY;
      });

      // Push all other nodes down so they don't overlap the header row
      const minWorkloadY = 200; // large clear gap below header
      const otherNodes = nodes.filter((n) => n.kind !== 'Node' && n.kind !== 'Namespace');
      const currentMinY = Math.min(...otherNodes.map((n) => n.y ?? 999));
      if (currentMinY < minWorkloadY) {
        const shift = minWorkloadY - currentMinY;
        otherNodes.forEach((n) => { if (n.y != null) n.y += shift; });
      }
    }

    resolve({ nodes, links });
  });
}

/**
 * Build links from resource nodes based on parent-child relationships.
 */
export function buildLinks(nodes: LayoutNode[]): LayoutLink[] {
  const links: LayoutLink[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      links.push({
        source: node.parentId,
        target: node.id,
        type: 'ownership',
      });
    }
  }

  return links;
}

/**
 * Filter nodes by namespace, label, or status.
 */
export function filterNodes(
  nodes: LayoutNode[],
  filters: {
    namespace?: string;
    status?: string;
    search?: string;
  }
): LayoutNode[] {
  return nodes.filter((node) => {
    if (filters.namespace && node.namespace !== filters.namespace) {
      return false;
    }
    if (filters.status && node.status !== filters.status) {
      return false;
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!node.name.toLowerCase().includes(search) && !node.id.includes(search)) {
        return false;
      }
    }
    return true;
  });
}
