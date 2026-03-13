import { SagaStateRepository } from '../../domain/repositories/saga-state.repository';
import { SagaStateDto, toSagaStateDto } from '../dtos/saga-state.dto';

export class GetSagaTreeQuery {
  constructor(private readonly sagaStateRepo: SagaStateRepository) {}

  async execute(rootId: string): Promise<SagaStateDto[]> {
    const records = await this.sagaStateRepo.findByRootId(rootId);
    return records.map(toSagaStateDto);
  }
}
