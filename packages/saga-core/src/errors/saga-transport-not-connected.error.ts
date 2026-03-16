import { SagaError } from "./saga.error";

export class SagaTransportNotConnectedError extends SagaError {
  constructor() {
    super("Transport not connected");
    this.name = "SagaTransportNotConnectedError";
  }
}
