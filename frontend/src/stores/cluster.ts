import { create } from 'zustand';

export interface ResourceNode {
  uid: string;
  kind: string;
  name: string;
  namespace?: string;
  status: HealthStatus;
  labels: Record<string, string>;
  metrics?: ResourceMetrics;
  parentUid?: string;
  clusterId: string;
  ageSeconds?: number;
  restartCount?: number;
}

export interface ResourceMetrics {
  cpuUsageMillicores: number;
  cpuLimitMillicores?: number;
  memoryUsageBytes: number;
  memoryLimitBytes?: number;
}

export type HealthStatus =
  | { state: 'healthy' }
  | { state: 'warning'; message: string }
  | { state: 'critical'; message: string }
  | { state: 'unknown' };

export interface ClusterContext {
  name: string;
  clusterUrl: string;
  namespace?: string;
  connected: boolean;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ClusterState {
  contexts: ClusterContext[];
  activeContext: string | null;
  connectionStatus: ConnectionStatus;
  resources: Map<string, ResourceNode>;

  setContexts: (contexts: ClusterContext[]) => void;
  setActiveContext: (name: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  upsertResource: (resource: ResourceNode) => void;
  removeResource: (uid: string) => void;
  clearResources: () => void;
}

export const useClusterStore = create<ClusterState>((set) => ({
  contexts: [],
  activeContext: null,
  connectionStatus: 'disconnected',
  resources: new Map(),

  setContexts: (contexts) => set({ contexts }),
  setActiveContext: (name) => set({ activeContext: name }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  upsertResource: (resource) =>
    set((state) => {
      const next = new Map(state.resources);
      next.set(resource.uid, resource);
      return { resources: next };
    }),
  removeResource: (uid) =>
    set((state) => {
      const next = new Map(state.resources);
      next.delete(uid);
      return { resources: next };
    }),
  clearResources: () => set({ resources: new Map() }),
}));
