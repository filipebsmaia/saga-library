import { SagaStateRepository } from '../../domain/repositories/saga-state.repository';
import { SagaStateDto, toSagaStateDto } from '../dtos/saga-state.dto';

export class GetSagaDetailQuery {
  constructor(private readonly sagaStateRepo: SagaStateRepository) {}

  async execute(sagaId: string): Promise<SagaStateDto | null> {
    const record = await this.sagaStateRepo.findById(sagaId);
    return record ? toSagaStateDto(record) : null;
  }
}
