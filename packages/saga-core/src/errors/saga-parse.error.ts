import { SagaError } from "./saga.error";

export class SagaParseError extends SagaError {
  constructor(message: string) {
    super(message);
    this.name = "SagaParseError";
  }
}
