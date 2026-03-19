import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaPublisherProvider,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";
import { BulkActivationStore } from "../../stores/bulk-activation.store";

@Injectable()
@SagaParticipant("bulk-activation.requested", { fork: true })
export class BulkActivationForkParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(BulkActivationForkParticipant.name);

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { bulkId, lines } = event.payload as {
      bulkId: string;
      lines: number;
    };

    await randomDelay();

    this.logger.log(
      `Bulk activation ${bulkId} — fanning out ${lines} line activations`,
    );

    for (let index = 0; index < lines; index++) {
      const lineNumber = `+5511${Date.now().toString().slice(-8)}${index}`;

      await emit({
        topic: "line-activation.requested",
        stepName: "request-line-activation",
        payload: { bulkId, lineIndex: index, lineNumber },
      });

      this.logger.log(`Sub-saga forked for line ${index + 1}/${lines}`);
    }

    this.logger.log(
      `All ${lines} line activation sub-sagas forked for bulk ${bulkId}`,
    );
  }
}

@Injectable()
@SagaParticipant("line-activation.completed")
export class LineActivationCompletedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(LineActivationCompletedParticipant.name);

  constructor(
    private readonly bulkActivationStore: BulkActivationStore,
    private readonly sagaPublisher: SagaPublisherProvider,
  ) {
    super();
  }

  async handle(event: IncomingEvent): Promise<void> {
    const { bulkId, lineIndex, lineNumber } = event.payload as {
      bulkId: string;
      lineIndex: number;
      lineNumber: string;
    };

    this.logger.log(
      `Line ${lineIndex} (${lineNumber}) completed for bulk ${bulkId}`,
    );

    const record = this.bulkActivationStore.incrementCompleted(bulkId);

    if (record && record.completedLines >= record.totalLines) {
      this.logger.log(
        `Bulk activation ${bulkId} — all ${record.totalLines} lines completed`,
      );

      await this.sagaPublisher.emitToParent({
        topic: "bulk-activation.completed",
        stepName: "complete-bulk-activation",
        payload: {
          bulkId,
          totalLines: record.totalLines,
          completedAt: new Date().toISOString(),
        },
        hint: "final",
      });
    }
  }
}
