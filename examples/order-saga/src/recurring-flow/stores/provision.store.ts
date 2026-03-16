import { Injectable, Logger } from "@nestjs/common";

export type ProvisionStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface ProvisionRecord {
  provisionId: string;
  sagaId: string;
  productId: string;
  msisdn: string;
  packageId: string;
  status: ProvisionStatus;
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RFProvisionStore {
  private readonly logger = new Logger(RFProvisionStore.name);
  private readonly records = new Map<string, ProvisionRecord>();

  create(
    provisionId: string,
    sagaId: string,
    data: { productId: string; msisdn: string; packageId: string },
  ): ProvisionRecord {
    const now = new Date().toISOString();
    const record: ProvisionRecord = {
      provisionId,
      sagaId,
      ...data,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(provisionId, record);
    this.logger.log(
      `Provision ${provisionId} created for product ${data.productId}`,
    );
    return record;
  }

  updateStatus(
    provisionId: string,
    status: ProvisionStatus,
    statusReason?: string,
  ): ProvisionRecord | undefined {
    const record = this.records.get(provisionId);
    if (record) {
      record.status = status;
      if (statusReason) record.statusReason = statusReason;
      record.updatedAt = new Date().toISOString();
      this.logger.log(`Provision ${provisionId} status → ${status}`);
    }
    return record;
  }

  findOne(provisionId: string): ProvisionRecord | undefined {
    return this.records.get(provisionId);
  }

  findAll(): ProvisionRecord[] {
    return Array.from(this.records.values());
  }
}
