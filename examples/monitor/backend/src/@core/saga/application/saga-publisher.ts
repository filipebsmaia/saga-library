import type { SagaUpdate } from './types/projector.types';

export abstract class SagaPublisher {
  abstract publishSagaUpdate(state: SagaUpdate['state'], event: SagaUpdate['event']): Promise<void>;
}
