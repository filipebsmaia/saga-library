import { Injectable, Logger } from '@nestjs/common';

export type UpgradeStatus =
  | 'REQUESTED'
  | 'ELIGIBLE'
  | 'APPROVED'
  | 'MIGRATING'
  | 'COMPLETED'
  | 'ROLLED_BACK';

export interface UpgradeRecord {
  upgradeId: string;
  sagaId: string;
  migrationSagaId?: string;
  customerId: string;
  currentPlan: string;
  targetPlan: string;
  status: UpgradeStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UpgradeStore {
  private readonly logger = new Logger(UpgradeStore.name);
  private readonly records = new Map<string, UpgradeRecord>();

  create(
    upgradeId: string,
    sagaId: string,
    data: { customerId: string; currentPlan: string; targetPlan: string },
  ): UpgradeRecord {
    const now = new Date().toISOString();
    const record: UpgradeRecord = {
      upgradeId,
      sagaId,
      ...data,
      status: 'REQUESTED',
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(upgradeId, record);
    this.logger.log(`Upgrade ${upgradeId} created (saga: ${sagaId})`);
    return record;
  }

  updateStatus(upgradeId: string, status: UpgradeStatus): UpgradeRecord | undefined {
    const record = this.records.get(upgradeId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      this.logger.log(`Upgrade ${upgradeId} status → ${status}`);
    }
    return record;
  }

  setMigrationSaga(upgradeId: string, migrationSagaId: string): void {
    const record = this.records.get(upgradeId);
    if (record) {
      record.migrationSagaId = migrationSagaId;
      record.updatedAt = new Date().toISOString();
    }
  }

  findAll(): UpgradeRecord[] {
    return Array.from(this.records.values());
  }
}
