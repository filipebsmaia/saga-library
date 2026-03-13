import { Injectable, Logger } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from '@fbsm/saga-nestjs';
import type { IncomingEvent, Emit } from '@fbsm/saga-nestjs';
import { randomDelay } from '../../delay';
import { UpgradeStore } from '../../stores/upgrade.store';

@Injectable()
@SagaParticipant()
export class MigrationActivationParticipant extends SagaParticipantBase {
  readonly serviceId = 'migration-activation';
  private readonly logger = new Logger(MigrationActivationParticipant.name);

  constructor(private readonly upgradeStore: UpgradeStore) {
    super();
  }

  @SagaHandler('migration.provisioned')
  async handleMigrationProvisioned(event: IncomingEvent, emit: Emit): Promise<void> {
    const { upgradeId, customerId, currentPlan, targetPlan, provisioningId, simulateFailure } =
      event.payload as {
        upgradeId: string;
        customerId: string;
        currentPlan: string;
        targetPlan: string;
        provisioningId: string;
        simulateFailure?: boolean;
      };

    await randomDelay();

    if (simulateFailure) {
      this.logger.warn(`Migration activation FAILED for upgrade ${upgradeId} (simulated)`);

      await emit({
        eventType: 'migration.activation-failed',
        stepName: 'Fail Activation',
        stepDescription: 'Plan activation failed, triggering rollback',
        payload: {
          upgradeId,
          customerId,
          currentPlan,
          targetPlan,
          provisioningId,
          reason: 'Simulated provisioning error during plan activation',
        },
        hint: 'compensation',
      });
      return;
    }

    this.logger.log(`Migration activated for upgrade ${upgradeId}`);
    this.upgradeStore.updateStatus(upgradeId, 'COMPLETED');

    await emit({
      eventType: 'migration.activated',
      stepName: 'Activate New Plan',
      stepDescription: 'New plan activated successfully',
      payload: { upgradeId, customerId, targetPlan, provisioningId },
      hint: 'final',
    });
  }
}
