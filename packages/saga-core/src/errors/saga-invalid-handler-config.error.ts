import { SagaError } from "./saga.error";

export class SagaInvalidHandlerConfigError extends SagaError {
  constructor(topic: string, serviceId: string, reason: string) {
    super(
      `Invalid handler config for "${topic}" in "${serviceId}": ${reason}`,
    );
    this.name = "SagaInvalidHandlerConfigError";
  }
}
