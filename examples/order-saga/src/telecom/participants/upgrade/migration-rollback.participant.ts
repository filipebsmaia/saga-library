import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";
import { UpgradeStore } from "../../stores/upgrade.store";

@Injectable()
@SagaParticipant("migration.activation-failed")
export class MigrationRollbackParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(MigrationRollbackParticipant.name);

  constructor(private readonly upgradeStore: UpgradeStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { upgradeId, customerId, currentPlan, provisioningId, reason } =
      event.payload as {
        upgradeId: string;
        customerId: string;
        currentPlan: string;
        provisioningId: string;
        reason: string;
      };

    await randomDelay();

    this.logger.warn(
      `Rolling back migration for upgrade ${upgradeId}: ${reason}`,
    );
    this.upgradeStore.updateStatus(upgradeId, "ROLLED_BACK");

    await emit({
      topic: "migration.rolled-back",
      stepName: "Rollback Provisioning",
      stepDescription: "Provisioned resources rolled back",
      payload: {
        upgradeId,
        customerId,
        currentPlan,
        provisioningId,
      },
      hint: "final",
    });

    this.logger.log(`Migration rollback completed for upgrade ${upgradeId}`);
  }
}
