import { SagaError } from "./saga.error";

export class SagaDuplicateHandlerError extends SagaError {
  constructor(
    topic: string,
    existingServiceId: string,
    newServiceId: string,
  ) {
    super(
      `Duplicate handler for event type "${topic}": ` +
        `registered by "${existingServiceId}" and "${newServiceId}"`,
    );
    this.name = "SagaDuplicateHandlerError";
  }
}
