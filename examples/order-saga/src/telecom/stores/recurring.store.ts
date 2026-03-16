import { Injectable, Logger } from "@nestjs/common";

export type RecurringStatus =
  | "TRIGGERED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface RecurringRecord {
  recurringId: string;
  sagaId: string;
  planId: string;
  customerId: string;
  amount: number;
  cycle: number;
  status: RecurringStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RecurringStore {
  private readonly logger = new Logger(RecurringStore.name);
  private readonly records = new Map<string, RecurringRecord>();

  create(
    recurringId: string,
    sagaId: string,
    data: { planId: string; customerId: string; amount: number; cycle: number },
  ): RecurringRecord {
    const now = new Date().toISOString();
    const record: RecurringRecord = {
      recurringId,
      sagaId,
      ...data,
      status: "TRIGGERED",
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(recurringId, record);
    this.logger.log(
      `Recurring ${recurringId} created (cycle ${data.cycle}, saga: ${sagaId})`,
    );
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

  findOne(recurringId: string): RecurringRecord | undefined {
    return this.records.get(recurringId);
  }

  findAll(): RecurringRecord[] {
    return Array.from(this.records.values());
  }
}
