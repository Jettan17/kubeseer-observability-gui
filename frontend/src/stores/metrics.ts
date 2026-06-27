import { create } from 'zustand';

export type TimeWindow = '5m' | '1h' | '6h' | '24h' | '7d';

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface MetricSeries {
  name: string;
  unit: string;
  points: TimeSeriesPoint[];
}

interface MetricsState {
  timeWindow: TimeWindow;
  series: Record<string, MetricSeries[]>;

  setTimeWindow: (window: TimeWindow) => void;
  setSeries: (resourceUid: string, series: MetricSeries[]) => void;
  clearSeries: () => void;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  timeWindow: '1h',
  series: {},

  setTimeWindow: (window) => set({ timeWindow: window }),
  setSeries: (resourceUid, series) =>
    set((state) => ({
      series: { ...state.series, [resourceUid]: series },
    })),
  clearSeries: () => set({ series: {} }),
}));
