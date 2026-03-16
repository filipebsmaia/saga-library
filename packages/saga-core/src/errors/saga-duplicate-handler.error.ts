import { SagaError } from "./saga.error";

export class SagaDuplicateHandlerError extends SagaError {
  constructor(
    eventType: string,
    existingServiceId: string,
    newServiceId: string,
  ) {
    super(
      `Duplicate handler for event type "${eventType}": ` +
        `registered by "${existingServiceId}" and "${newServiceId}"`,
    );
    this.name = "SagaDuplicateHandlerError";
  }
}
