import { Injectable, Logger } from "@nestjs/common";

export type BulkActivationStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export interface BulkActivationRecord {
  bulkId: string;
  sagaId: string;
  totalLines: number;
  completedLines: number;
  subSagaIds: string[];
  status: BulkActivationStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class BulkActivationStore {
  private readonly logger = new Logger(BulkActivationStore.name);
  private readonly records = new Map<string, BulkActivationRecord>();
  private readonly bySagaId = new Map<string, string>();

  create(
    bulkId: string,
    sagaId: string,
    data: { totalLines: number },
  ): BulkActivationRecord {
    const now = new Date().toISOString();
    const record: BulkActivationRecord = {
      bulkId,
      sagaId,
      totalLines: data.totalLines,
      completedLines: 0,
      subSagaIds: [],
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(bulkId, record);
    this.bySagaId.set(sagaId, bulkId);
    this.logger.log(
      `BulkActivation ${bulkId} created (saga: ${sagaId}, lines: ${data.totalLines})`,
    );
    return record;
  }

  addSubSaga(bulkId: string, subSagaId: string): void {
    const record = this.records.get(bulkId);
    if (record) {
      record.subSagaIds.push(subSagaId);
      record.status = "IN_PROGRESS";
      record.updatedAt = new Date().toISOString();
      this.bySagaId.set(subSagaId, bulkId);
    }
  }

  incrementCompleted(bulkId: string): BulkActivationRecord | undefined {
    const record = this.records.get(bulkId);
    if (record) {
      record.completedLines++;
      record.updatedAt = new Date().toISOString();
      this.logger.log(
        `BulkActivation ${bulkId}: ${record.completedLines}/${record.totalLines} completed`,
      );
      if (record.completedLines >= record.totalLines) {
        record.status = "COMPLETED";
      }
    }
    return record;
  }

  findBySagaId(sagaId: string): BulkActivationRecord | undefined {
    const bulkId = this.bySagaId.get(sagaId);
    return bulkId ? this.records.get(bulkId) : undefined;
  }

  findOne(bulkId: string): BulkActivationRecord | undefined {
    return this.records.get(bulkId);
  }

  findAll(): BulkActivationRecord[] {
    return Array.from(this.records.values());
  }
}
