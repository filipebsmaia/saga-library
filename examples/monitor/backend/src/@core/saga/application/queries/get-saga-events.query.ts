import { SagaEventLogRepository } from '../../domain/repositories/saga-event-log.repository';
import { SagaStateRepository, SagaStateRecord } from '../../domain/repositories/saga-state.repository';
import { SagaEventDto, toSagaEventDto } from '../dtos/saga-event.dto';
import type { CursorPaginationResult } from '@core/common/types/cursor-pagination.type';

export class GetSagaEventsQuery {
  constructor(
    private readonly sagaEventLogRepo: SagaEventLogRepository,
    private readonly sagaStateRepo: SagaStateRepository,
  ) {}

  async execute(sagaId: string, cursor?: string, limit?: number): Promise<CursorPaginationResult<SagaEventDto>> {
    const effectiveLimit = limit ?? 50;

    // Collect sagaId + all descendant saga IDs
    const sagaIds = await this.collectDescendantIds(sagaId);

    const records = await this.sagaEventLogRepo.findBySagaIds(sagaIds, cursor, effectiveLimit);

    const hasMore = records.length > effectiveLimit;
    const data = hasMore ? records.slice(0, effectiveLimit) : records;

    return {
      data: data.map(toSagaEventDto),
      nextCursor: hasMore ? data[data.length - 1].sagaEventId : null,
    };
  }

  private async collectDescendantIds(sagaId: string): Promise<string[]> {
    const state = await this.sagaStateRepo.findById(sagaId);
    if (!state) return [sagaId];

    const allStates = await this.sagaStateRepo.findByRootId(state.sagaRootId);

    // Build parent → children map (skip self-references to avoid infinite loops)
    const childrenMap = new Map<string, SagaStateRecord[]>();
    for (const s of allStates) {
      if (s.sagaParentId && s.sagaParentId !== s.sagaId) {
        const children = childrenMap.get(s.sagaParentId) ?? [];
        children.push(s);
        childrenMap.set(s.sagaParentId, children);
      }
    }

    // BFS from sagaId to collect all descendants
    const result: string[] = [sagaId];
    const queue: string[] = [sagaId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = childrenMap.get(current) ?? [];
      for (const child of children) {
        result.push(child.sagaId);
        queue.push(child.sagaId);
      }
    }

    return result;
  }
}
