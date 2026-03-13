export type EventHint = 'compensation' | 'final' | 'fork';

export interface EmitParams<T extends object = Record<string, unknown>> {
  eventType: string;
  stepName: string;
  stepDescription?: string;
  payload: T;
  hint?: EventHint;
  key?: string;
}

export type Emit = <T extends object>(params: EmitParams<T>) => Promise<void>;
