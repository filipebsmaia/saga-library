import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
  SagaPublisherProvider,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../telecom/delay";
import { RFRecurringStore } from "../stores/recurring.store";

@Injectable()
@SagaParticipant()
export class RFPlanRecurringManagementParticipant extends SagaParticipantBase {
  readonly serviceId = "rf-plan-recurring-management";
  private readonly logger = new Logger(
    RFPlanRecurringManagementParticipant.name,
  );

  constructor(
    private readonly recurringStore: RFRecurringStore,
    private readonly sagaPublisher: SagaPublisherProvider,
  ) {
    super();
  }

  @SagaHandler("rf.plan-ordering.order.updated.completed")
  async handlePlanOrderCompleted(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const { recurringId, planId, customerId, amount, cycle } =
      event.payload as {
        recurringId: string;
        planId: string;
        customerId: string;
        amount: number;
        cycle: number;
      };

    await randomDelay();

    this.logger.log(
      `Recurring ${recurringId} payment completed — marking COMPLETED`,
    );
    this.recurringStore.updateStatus(recurringId, "COMPLETED");

    await emit({
      eventType: "rf.recurring.completed",
      stepName: "complete-recurring",
      stepDescription:
        "plan-recurring-management marca recorrência como COMPLETED",
      payload: { recurringId, planId, customerId, cycle },
      hint: "final",
    });

    // Start child saga for next cycle + product provisioning
    const newCycle = cycle + 1;
    const newRecurringId = uuidv7();
    const scheduledTo = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { sagaId: newSagaId } = await this.sagaPublisher.startChild(
      async () => {
        await this.sagaPublisher.emit({
          eventType: "rf.recurring.created",
          stepName: "create-recurring-cycle",
          stepDescription: "Nova recorrência criada para o próximo ciclo",
          payload: {
            recurringId: newRecurringId,
            planId,
            customerId,
            amount,
            cycle: newCycle,
            msisdn: `+5541${Date.now().toString().slice(-8)}`,
          },
          hint: "fork",
        });
      },
    );

    this.recurringStore.create(newRecurringId, newSagaId, {
      planId,
      customerId,
      amount,
      cycle: newCycle,
      maxAttempts: 3,
      scheduledTo,
    });

    this.logger.log(
      `New recurring ${newRecurringId} created for cycle ${newCycle} (saga: ${newSagaId})`,
    );
  }

  @SagaHandler("rf.plan-ordering.order.updated.payment-failed")
  async handlePlanOrderPaymentFailed(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const { recurringId, planId, customerId, reason } = event.payload as {
      recurringId: string;
      planId: string;
      customerId: string;
      reason: string;
    };

    await randomDelay();

    const record = this.recurringStore.findOne(recurringId);
    if (!record) {
      this.logger.error(`Recurring ${recurringId} not found`);
      return;
    }

    if (record.totalAttempts >= record.maxAttempts) {
      // Max attempts exceeded — mark as FAILED
      this.recurringStore.updateStatus(recurringId, "FAILED");
      this.logger.error(
        `Recurring ${recurringId} FAILED — max attempts (${record.maxAttempts}) exceeded`,
      );

      await emit({
        eventType: "rf.recurring.updated.failed",
        stepName: "fail-recurring",
        stepDescription:
          "plan-recurring-management marca recorrência como FAILED (max tentativas)",
        payload: { recurringId, planId, customerId, reason },
        hint: "compensation",
      });
    } else {
      // Mark as CAPTURE_FAILED — can be retried
      this.recurringStore.updateStatus(recurringId, "CAPTURE_FAILED");
      this.logger.warn(
        `Recurring ${recurringId} CAPTURE_FAILED (attempt ${record.totalAttempts}/${record.maxAttempts}) — ${reason}`,
      );

      await emit({
        eventType: "rf.recurring.updated.capture-failed",
        stepName: "capture-failed-recurring",
        stepDescription:
          "plan-recurring-management marca recorrência como CAPTURE_FAILED",
        payload: { recurringId, planId, customerId, reason },
        hint: "final",
      });
    }
  }
}
