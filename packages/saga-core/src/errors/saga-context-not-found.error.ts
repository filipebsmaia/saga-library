import { SagaError } from "./saga.error";

export class SagaContextNotFoundError extends SagaError {
  constructor() {
    super(
      "No saga context found. Ensure you are inside a saga handler or after sagaPublisher.start().",
    );
    this.name = "SagaContextNotFoundError";
  }
}
