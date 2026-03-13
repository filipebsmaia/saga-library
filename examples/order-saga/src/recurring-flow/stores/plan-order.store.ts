import { Injectable, Logger } from '@nestjs/common';

export type PlanOrderStatus = 'PENDING' | 'COMPLETED' | 'PAYMENT_FAILED';

export interface PlanOrderRecord {
  planOrderId: string;
  sagaId: string;
  recurringId: string;
  planId: string;
  customerId: string;
  amount: number;
  orderType: 'RECURRING' | 'CHANGE';
  status: PlanOrderStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RFPlanOrderStore {
  private readonly logger = new Logger(RFPlanOrderStore.name);
  private readonly records = new Map<string, PlanOrderRecord>();

  create(
    planOrderId: string,
    sagaId: string,
    data: {
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      orderType: 'RECURRING' | 'CHANGE';
    },
  ): PlanOrderRecord {
    const now = new Date().toISOString();
    const record: PlanOrderRecord = {
      planOrderId,
      sagaId,
      ...data,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(planOrderId, record);
    this.logger.log(`PlanOrder ${planOrderId} created (type: ${data.orderType})`);
    return record;
  }

  updateStatus(planOrderId: string, status: PlanOrderStatus): PlanOrderRecord | undefined {
    const record = this.records.get(planOrderId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      this.logger.log(`PlanOrder ${planOrderId} status → ${status}`);
    }
    return record;
  }

  findOne(planOrderId: string): PlanOrderRecord | undefined {
    return this.records.get(planOrderId);
  }

  findAll(): PlanOrderRecord[] {
    return Array.from(this.records.values());
  }
}
