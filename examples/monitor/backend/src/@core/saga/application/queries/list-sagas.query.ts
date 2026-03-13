import { SagaStateRepository, SagaStateFilter } from '../../domain/repositories/saga-state.repository';
import { SagaStateDto, toSagaStateDto } from '../dtos/saga-state.dto';
import type { CursorPaginationResult } from '@core/common/types/cursor-pagination.type';

export class ListSagasQuery {
  constructor(private readonly sagaStateRepo: SagaStateRepository) {}

  async execute(filter: SagaStateFilter): Promise<CursorPaginationResult<SagaStateDto>> {
    const limit = filter.limit ?? 20;
    const records = await this.sagaStateRepo.findMany({ ...filter, limit });

    const hasMore = records.length > limit;
    const data = hasMore ? records.slice(0, limit) : records;

    return {
      data: data.map(toSagaStateDto),
      nextCursor: hasMore ? data[data.length - 1].sagaId : null,
    };
  }
}
