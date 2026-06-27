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
      .force('charge', forceManyBody().strength(-200).distanceMax(300))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collision',
        forceCollide<LayoutNode>()
          .radius((d) => d.radius + 4)
          .strength(0.8)
      )
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
