import { SagaError } from "./saga.error";

export class SagaInvalidHandlerConfigError extends SagaError {
  constructor(eventType: string, serviceId: string, reason: string) {
    super(
      `Invalid handler config for "${eventType}" in "${serviceId}": ${reason}`,
    );
    this.name = "SagaInvalidHandlerConfigError";
  }
}
