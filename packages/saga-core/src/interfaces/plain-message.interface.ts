export interface PlainMessage<T = unknown> {
  topic: string;
  key: string;
  payload: T;
  headers: Record<string, string>;
  timestamp?: string;
}

export type PlainHandler<T = unknown> = (
  message: PlainMessage<T>,
) => Promise<void>;
