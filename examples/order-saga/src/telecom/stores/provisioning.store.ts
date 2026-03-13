import { Injectable } from "@nestjs/common";

export interface ProvisioningRecord {
  provisioningId: string;
  sagaId: string;
  deviceSerial: string;
  status: "REQUESTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  currentStep?: string;
  completedAt?: string;
}

@Injectable()
export class ProvisioningStore {
  private readonly records = new Map<string, ProvisioningRecord>();

  create(provisioningId: string, sagaId: string, deviceSerial: string): void {
    this.records.set(provisioningId, {
      provisioningId,
      sagaId,
      deviceSerial,
      status: "REQUESTED",
    });
  }

  updateStep(provisioningId: string, currentStep: string): void {
    const record = this.records.get(provisioningId);
    if (record) {
      record.status = "IN_PROGRESS";
      record.currentStep = currentStep;
    }
  }

  complete(provisioningId: string): void {
    const record = this.records.get(provisioningId);
    if (record) {
      record.status = "COMPLETED";
      record.currentStep = undefined;
      record.completedAt = new Date().toISOString();
    }
  }

  findAll(): ProvisioningRecord[] {
    return Array.from(this.records.values());
  }
}
