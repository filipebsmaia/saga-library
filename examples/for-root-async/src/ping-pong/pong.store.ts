import { Injectable } from "@nestjs/common";

export interface PongRecord {
  sagaId: string;
  message: string;
  pongedAt: string;
}

@Injectable()
export class PongStore {
  private readonly records: PongRecord[] = [];

  add(sagaId: string, message: string, pongedAt: string): void {
    this.records.push({ sagaId, message, pongedAt });
  }

  getAll(): PongRecord[] {
    return [...this.records];
  }
}
