import { Injectable, Logger } from '@nestjs/common';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type PaymentMethod = 'CARD' | 'PIX' | 'INVOICE';

export interface PaymentRecord {
  paymentId: string;
  sagaId: string;
  orderId: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId: string;
  createdAt: string;
  updatedAt: string;
}

const METHODS: PaymentMethod[] = ['CARD', 'PIX', 'INVOICE'];

@Injectable()
export class RFPaymentStore {
  private readonly logger = new Logger(RFPaymentStore.name);
  private readonly records = new Map<string, PaymentRecord>();

  create(
    paymentId: string,
    sagaId: string,
    data: { orderId: string; customerId: string; amount: number; status: PaymentStatus },
  ): PaymentRecord {
    const now = new Date().toISOString();
    const method = METHODS[Math.floor(Math.random() * METHODS.length)];
    const record: PaymentRecord = {
      paymentId,
      sagaId,
      ...data,
      method,
      transactionId: `txn-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(paymentId, record);
    this.logger.log(`Payment ${paymentId} created (${method}, ${data.status})`);
    return record;
  }

  findOne(paymentId: string): PaymentRecord | undefined {
    return this.records.get(paymentId);
  }

  findAll(): PaymentRecord[] {
    return Array.from(this.records.values());
  }
}
