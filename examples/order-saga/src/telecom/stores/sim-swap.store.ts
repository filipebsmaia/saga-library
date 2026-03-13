import { Injectable, Logger } from '@nestjs/common';

export type SimSwapStatus = 'PENDING' | 'VALIDATING' | 'COMPLETED';

export interface SimSwapRecord {
  swapId: string;
  sagaId: string;
  msisdn: string;
  newIccid: string;
  validationSagaId?: string;
  status: SimSwapStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SimSwapStore {
  private readonly logger = new Logger(SimSwapStore.name);
  private readonly records = new Map<string, SimSwapRecord>();
  private readonly bySagaId = new Map<string, string>();

  create(
    swapId: string,
    sagaId: string,
    data: { msisdn: string; newIccid: string },
  ): SimSwapRecord {
    const now = new Date().toISOString();
    const record: SimSwapRecord = {
      swapId,
      sagaId,
      ...data,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(swapId, record);
    this.bySagaId.set(sagaId, swapId);
    this.logger.log(`SimSwap ${swapId} created (saga: ${sagaId})`);
    return record;
  }

  setValidationSaga(swapId: string, validationSagaId: string): void {
    const record = this.records.get(swapId);
    if (record) {
      record.validationSagaId = validationSagaId;
      record.status = 'VALIDATING';
      record.updatedAt = new Date().toISOString();
      this.bySagaId.set(validationSagaId, swapId);
    }
  }

  updateStatus(swapId: string, status: SimSwapStatus): SimSwapRecord | undefined {
    const record = this.records.get(swapId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      this.logger.log(`SimSwap ${swapId} status → ${status}`);
    }
    return record;
  }

  findBySagaId(sagaId: string): SimSwapRecord | undefined {
    const swapId = this.bySagaId.get(sagaId);
    return swapId ? this.records.get(swapId) : undefined;
  }

  findOne(swapId: string): SimSwapRecord | undefined {
    return this.records.get(swapId);
  }

  findAll(): SimSwapRecord[] {
    return Array.from(this.records.values());
  }
}
