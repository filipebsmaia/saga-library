import { Injectable, Logger } from "@nestjs/common";

export type ProductStatus =
  | "ACKNOWLEDGED"
  | "PENDING"
  | "ACTIVE"
  | "SUSPENDED"
  | "TERMINATED";

export interface ProductRecord {
  productId: string;
  sagaId: string;
  customerId: string;
  planId: string;
  msisdn: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RFProductStore {
  private readonly logger = new Logger(RFProductStore.name);
  private readonly records = new Map<string, ProductRecord>();

  create(
    productId: string,
    sagaId: string,
    data: { customerId: string; planId: string; msisdn: string },
  ): ProductRecord {
    const now = new Date().toISOString();
    const record: ProductRecord = {
      productId,
      sagaId,
      ...data,
      status: "ACKNOWLEDGED",
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(productId, record);
    this.logger.log(`Product ${productId} created as ACKNOWLEDGED`);
    return record;
  }

  updateStatus(
    productId: string,
    status: ProductStatus,
  ): ProductRecord | undefined {
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
