export interface TopStepDto {
  stepName: string;
  sagaName: string | null;
  count: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

export interface TopSagaTypeDto {
  sagaName: string;
  volume: number;
  avgDurationMs: number;
  compensationRatio: number;
}
