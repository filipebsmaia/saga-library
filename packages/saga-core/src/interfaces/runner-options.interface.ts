export interface RunnerOptions {
  groupId: string;
  fromBeginning?: boolean;
  /** Prefix prepended to topic to form Kafka topic names. Default: '' (no prefix). */
  topicPrefix?: string;
  retryPolicy?: {
    maxRetries?: number;
    initialDelayMs?: number;
  };
}
