export class SagaError extends Error {
  public isSagaError = true;
  
  constructor(message: string) {
    super(message);
    this.name = 'SagaError';
  }
}
