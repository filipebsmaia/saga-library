import { Injectable, Logger } from "@nestjs/common";

export type PlanStatus =
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "SUSPENDED"
  | "CANCELLED";

export interface PlanRecord {
  planId: string;
  customerId: string;
  planName: string;
  status: PlanStatus;
  hasPendingChanges: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RFPlanStore {
  private readonly logger = new Logger(RFPlanStore.name);
  private readonly records = new Map<string, PlanRecord>();

  create(
    planId: string,
    data: { customerId: string; planName: string; hasPendingChanges?: boolean },
  ): PlanRecord {
    const now = new Date().toISOString();
    const record: PlanRecord = {
      planId,
      ...data,
      status: "ACTIVE",
      hasPendingChanges: data.hasPendingChanges ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(planId, record);
    this.logger.log(`Plan ${planId} created (${data.planName})`);
    return record;
  }

  updateStatus(planId: string, status: PlanStatus): PlanRecord | undefined {
    const record = this.records.get(planId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      this.logger.log(`Plan ${planId} status → ${status}`);
    }
    return record;
  }

  findOne(planId: string): PlanRecord | undefined {
    return this.records.get(planId);
  }

  findAll(): PlanRecord[] {
    return Array.from(this.records.values());
  }
}
