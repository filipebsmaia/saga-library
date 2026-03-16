import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../delay";

@Injectable()
@SagaParticipant()
export class MigrationProvisioningParticipant extends SagaParticipantBase {
  readonly serviceId = "migration-provisioning";
  private readonly logger = new Logger(MigrationProvisioningParticipant.name);

  @SagaHandler("migration.started")
  async handleMigrationStarted(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
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
      eventType: "migration.provisioned",
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
