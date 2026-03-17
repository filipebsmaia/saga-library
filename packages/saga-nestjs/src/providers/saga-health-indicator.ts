import { Inject, Injectable } from "@nestjs/common";
import { SagaRunner } from "@fbsm/saga-core";
import type { TransportHealthResult } from "@fbsm/saga-core";

@Injectable()
export class SagaHealthIndicator {
  constructor(@Inject(SagaRunner) private readonly runner: SagaRunner) {}

  async check(): Promise<TransportHealthResult> {
    return this.runner.healthCheck();
  }
}
