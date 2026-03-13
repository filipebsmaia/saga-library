import { Injectable, Logger } from '@nestjs/common';

export type ProductStatus = 'PENDING' | 'PROVISIONED' | 'ACTIVE';

export interface ProductRecord {
  productId: string;
  sagaId: string;
  recurringId: string;
  customerId: string;
  planId: string;
  msisdn: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProductStore {
  private readonly logger = new Logger(ProductStore.name);
  private readonly records = new Map<string, ProductRecord>();

  create(
    productId: string,
    sagaId: string,
    data: { recurringId: string; customerId: string; planId: string; msisdn: string },
  ): ProductRecord {
    const now = new Date().toISOString();
    const record: ProductRecord = {
      productId,
      sagaId,
      ...data,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(productId, record);
    this.logger.log(`Product ${productId} created as PENDING (saga: ${sagaId})`);
    return record;
  }

  updateStatus(productId: string, status: ProductStatus): ProductRecord | undefined {
    const record = this.records.get(productId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      this.logger.log(`Product ${productId} status → ${status}`);
    }
    return record;
  }

  findOne(productId: string): ProductRecord | undefined {
    return this.records.get(productId);
  }

  findAll(): ProductRecord[] {
    return Array.from(this.records.values());
  }
}
