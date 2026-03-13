export interface TopTypeRecord {
  sagaName: string;
  volume: number;
  avgDurationMs: number;
  compensationRatio: number;
}

export abstract class SagaDashboardService {
  abstract countByStatus(): Promise<Record<string, number>>;
  abstract countStuck(thresholdMs: number): Promise<number>;
  abstract findTopTypes(since: Date, limit: number): Promise<TopTypeRecord[]>;
}
