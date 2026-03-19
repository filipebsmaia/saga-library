import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../delay";

@Injectable()
@SagaParticipant("migration.started")
export class MigrationProvisioningParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(MigrationProvisioningParticipant.name);

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { upgradeId, customerId, currentPlan, targetPlan, simulateFailure } =
      event.payload as {
        upgradeId: string;
        customerId: string;
        currentPlan: string;
        targetPlan: string;
        simulateFailure?: boolean;
      };

    await randomDelay();

    const provisioningId = uuidv7();
    this.logger.log(
      `Provisioning new plan resources for upgrade ${upgradeId} (ref: ${provisioningId})`,
    );

    await emit({
      topic: "migration.provisioned",
      stepName: "Provision New Plan",
      stepDescription: "New plan resources provisioned",
      payload: {
        upgradeId,
        customerId,
        currentPlan,
        targetPlan,
        provisioningId,
        simulateFailure,
      },
    });
  }
}
