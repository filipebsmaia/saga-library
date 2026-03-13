import { SagaStatus } from '../../domain/types/saga-status.enum';

export type AttentionReason = 'stuck' | 'compensating' | 'many_children';

export interface AttentionItemDto {
  sagaId: string;
  sagaRootId: string;
  sagaName: string | null;
  status: SagaStatus;
  reason: AttentionReason;
  currentStepName: string;
  updatedAt: string;
  startedAt: string;
  durationMs: number;
  detail: string;
}

export interface AttentionResponseDto {
  items: AttentionItemDto[];
}
