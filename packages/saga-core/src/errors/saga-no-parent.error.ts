import { SagaError } from "./saga.error";

export class SagaNoParentError extends SagaError {
  constructor() {
    super("No parentSagaId in current saga context.");
    this.name = "SagaNoParentError";
  }
}
