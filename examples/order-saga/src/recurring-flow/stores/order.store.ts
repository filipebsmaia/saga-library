import { Injectable, Logger } from "@nestjs/common";

export type OrderStatus = "PENDING" | "COMPLETED" | "PAYMENT_FAILED";

export interface OrderRecord {
  orderId: string;
  sagaId: string;
  planOrderId: string;
  customerId: string;
  amount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RFOrderStore {
  private readonly logger = new Logger(RFOrderStore.name);
  private readonly records = new Map<string, OrderRecord>();

  create(
    orderId: string,
    sagaId: string,
    data: { planOrderId: string; customerId: string; amount: number },
  ): OrderRecord {
    const now = new Date().toISOString();
    const record: OrderRecord = {
      orderId,
      sagaId,
      ...data,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(orderId, record);
    this.logger.log(`Order ${orderId} created (saga: ${sagaId})`);
    return record;
  }

  updateStatus(orderId: string, status: OrderStatus): OrderRecord | undefined {
    const record = this.records.get(orderId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      this.logger.log(`Order ${orderId} status → ${status}`);
    }
    return record;
  }

  findOne(orderId: string): OrderRecord | undefined {
    return this.records.get(orderId);
  }

  findAll(): OrderRecord[] {
    return Array.from(this.records.values());
  }
}
