import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
  SagaPublisherProvider,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";
import { UpgradeStore } from "../../stores/upgrade.store";

@Injectable()
@SagaParticipant()
export class UpgradeApprovalParticipant extends SagaParticipantBase {
  readonly serviceId = "upgrade-approval";
  private readonly logger = new Logger(UpgradeApprovalParticipant.name);

  constructor(
    private readonly upgradeStore: UpgradeStore,
    private readonly sagaPublisher: SagaPublisherProvider,
  ) {
    super();
  }

  @SagaHandler("upgrade.eligible")
  async handleUpgradeEligible(event: IncomingEvent, emit: Emit): Promise<void> {
    const { upgradeId, customerId, currentPlan, targetPlan, simulateFailure } =
      event.payload as {
        upgradeId: string;
        customerId: string;
        currentPlan: string;
        targetPlan: string;
        simulateFailure?: boolean;
      };

    await randomDelay();

    this.logger.log(`Approving upgrade ${upgradeId}`);
    this.upgradeStore.updateStatus(upgradeId, "APPROVED");

    // Final event on Saga A
    await emit({
      eventType: "upgrade.approved",
      stepName: "Approve Upgrade",
      stepDescription: "Plan upgrade approved, starting migration",
      payload: { upgradeId, customerId, currentPlan, targetPlan },
      hint: "final",
    });

    // Start Saga B (migration) via startChild — gets its own rootSagaId
    const { sagaId: migrationSagaId } = await this.sagaPublisher.startChild(
      async () => {
        await this.sagaPublisher.emit({
          eventType: "migration.started",
          stepName: "Start Migration",
          stepDescription: "Plan migration saga initiated",
          payload: {
            upgradeId,
            customerId,
            currentPlan,
            targetPlan,
            simulateFailure,
          },
        });
      },
      {
        sagaName: "Migração de Plano",
        sagaDescription: `Migração ${currentPlan} → ${targetPlan}`,
      },
    );

    this.upgradeStore.setMigrationSaga(upgradeId, migrationSagaId);
    this.upgradeStore.updateStatus(upgradeId, "MIGRATING");

    this.logger.log(
      `Migration saga ${migrationSagaId} started for upgrade ${upgradeId}`,
    );
  }
}
