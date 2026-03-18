import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";
import { UpgradeStore } from "../../stores/upgrade.store";

@Injectable()
@SagaParticipant()
export class UpgradeEligibilityParticipant extends SagaParticipantBase {
  readonly serviceId = "upgrade-eligibility";
  private readonly logger = new Logger(UpgradeEligibilityParticipant.name);

  constructor(private readonly upgradeStore: UpgradeStore) {
    super();
  }

  @SagaHandler("upgrade.requested")
  async handleUpgradeRequested(
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

    this.logger.log(
      `Validating eligibility for upgrade ${upgradeId}: ${currentPlan} → ${targetPlan}`,
    );
    this.upgradeStore.updateStatus(upgradeId, "ELIGIBLE");

    await emit({
      topic: "upgrade.eligible",
      stepName: "Validate Eligibility",
      stepDescription: "Customer eligibility validated for plan upgrade",
      payload: {
        upgradeId,
        customerId,
        currentPlan,
        targetPlan,
        simulateFailure,
      },
    });
  }
}
