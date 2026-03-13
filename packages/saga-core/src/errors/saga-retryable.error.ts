import { SagaError } from './saga.error';

export class SagaRetryableError extends SagaError {
  constructor(
    message: string,
    readonly maxRetries = 3,
  ) {
    super(message);
    this.name = 'SagaRetryableError';
  }
}
