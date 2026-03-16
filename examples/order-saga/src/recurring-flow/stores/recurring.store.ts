import { Injectable, Logger } from "@nestjs/common";

export type RecurringStatus =
  | "SCHEDULED"
  | "PROCESSING"
  | "COMPLETED"
  | "CAPTURE_FAILED"
  | "FAILED"
  | "CANCELLED";

export interface RecurringRecord {
  recurringId: string;
  sagaId: string;
  planId: string;
  customerId: string;
  amount: number;
  cycle: number;
  status: RecurringStatus;
  totalAttempts: number;
  maxAttempts: number;
  scheduledTo: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RFRecurringStore {
  private readonly logger = new Logger(RFRecurringStore.name);
  private readonly records = new Map<string, RecurringRecord>();

  create(
    recurringId: string,
    sagaId: string,
    data: {
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
      maxAttempts: number;
      scheduledTo: string;
    },
  ): RecurringRecord {
    const now = new Date().toISOString();
    const record: RecurringRecord = {
      recurringId,
      sagaId,
      ...data,
      status: "SCHEDULED",
      totalAttempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(recurringId, record);
    this.logger.log(`Recurring ${recurringId} created (cycle ${data.cycle})`);
    return record;
  }

  updateStatus(
    recurringId: string,
    status: RecurringStatus,
  ): RecurringRecord | undefined {
    const record = this.records.get(recurringId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      this.logger.log(`Recurring ${recurringId} status → ${status}`);
    }
    return record;
  }

  incrementAttempt(recurringId: string): RecurringRecord | undefined {
    const record = this.records.get(recurringId);
    if (record) {
      record.totalAttempts++;
      record.status = "PROCESSING";
      record.updatedAt = new Date().toISOString();
      this.logger.log(
        `Recurring ${recurringId} attempt ${record.totalAttempts}/${record.maxAttempts}`,
      );
    }
    return record;
  }

  updateSagaId(recurringId: string, sagaId: string): void {
    const record = this.records.get(recurringId);
    if (record) {
      record.sagaId = sagaId;
    }
  }

  findOne(recurringId: string): RecurringRecord | undefined {
    return this.records.get(recurringId);
  }

  findAll(): RecurringRecord[] {
    return Array.from(this.records.values());
  }
}
