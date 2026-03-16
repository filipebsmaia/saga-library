import { SagaStateRepository } from '../../domain/repositories/saga-state.repository';
import { AttentionItemDto, AttentionReason, AttentionResponseDto } from '../dtos/attention-items.dto';

const STUCK_THRESHOLD_MS = 5 * 60_000;
const ATTENTION_LIMIT = 50;
const RESULT_LIMIT = 20;
const MANY_CHILDREN_THRESHOLD = 3;

const PRIORITY: Record<AttentionReason, number> = {
  stuck: 0,
  compensating: 1,
  many_children: 2,
};

export class GetAttentionItemsQuery {
  constructor(private readonly sagaStateRepo: SagaStateRepository) {}

  async execute(): Promise<AttentionResponseDto> {
    const activeSagas = await this.sagaStateRepo.findActiveWithAttention(ATTENTION_LIMIT);

    const now = Date.now();
    const items = new Map<string, AttentionItemDto>();

    // Count children per root
    const childrenPerRoot = new Map<string, string[]>();
    for (const saga of activeSagas) {
      const list = childrenPerRoot.get(saga.sagaRootId) ?? [];
      list.push(saga.sagaId);
      childrenPerRoot.set(saga.sagaRootId, list);
    }

    for (const saga of activeSagas) {
      const durationMs = now - saga.startedAt.getTime();
      const updatedAgo = now - saga.updatedAt.getTime();

      let reason: AttentionReason | null = null;
      let detail = '';

      if (updatedAgo > STUCK_THRESHOLD_MS) {
        reason = 'stuck';
        const mins = Math.round(updatedAgo / 60_000);
        detail = `No update in ${mins}m`;
      } else if (saga.status === 'COMPENSATING') {
        reason = 'compensating';
        detail = `Compensating for ${Math.round(durationMs / 1000)}s`;
      }

      // Check many_children only for root sagas
      if (reason === null && saga.sagaRootId === saga.sagaId) {
        const children = childrenPerRoot.get(saga.sagaRootId);
        if (children && children.length >= MANY_CHILDREN_THRESHOLD) {
          reason = 'many_children';
          detail = `${children.length} active children`;
        }
      }

      if (reason === null) continue;

      // Dedup: keep highest priority reason
      const existing = items.get(saga.sagaId);
      if (existing && PRIORITY[existing.reason] <= PRIORITY[reason]) continue;

      items.set(saga.sagaId, {
        sagaId: saga.sagaId,
        sagaRootId: saga.sagaRootId,
        sagaName: saga.sagaName,
        status: saga.status,
        reason,
        currentStepName: saga.currentStepName,
        updatedAt: saga.updatedAt.toISOString(),
        startedAt: saga.startedAt.toISOString(),
        durationMs,
        detail,
      });
    }

    const sorted = [...items.values()].sort((a, b) => PRIORITY[a.reason] - PRIORITY[b.reason]).slice(0, RESULT_LIMIT);

    return { items: sorted };
  }
}
