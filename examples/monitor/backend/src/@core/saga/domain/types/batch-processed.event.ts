export interface BatchProcessedEvent {
  topic: string;
  partition: number;
  messageCount: number;
  processed: number;
  skipped: number;
  deduped: number;
  completedGuard: number;
  errors: number;
  phases: {
    dedupeMs: number;
    lookupMs: number;
    persistMs: number;
    publishMs: number;
  };
  totalMs: number;
}
