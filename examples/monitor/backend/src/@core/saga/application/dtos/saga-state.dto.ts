import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SagaStateRecord } from '../../domain/repositories/saga-state.repository';

export class SagaStateDto {
  @ApiProperty() sagaId!: string;
  @ApiProperty() sagaRootId!: string;
  @ApiPropertyOptional() sagaParentId!: string | null;
  @ApiPropertyOptional() sagaName!: string | null;
  @ApiPropertyOptional() sagaDescription!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() currentStepName!: string;
  @ApiPropertyOptional() currentStepDescription!: string | null;
  @ApiProperty() lastEventId!: string;
  @ApiPropertyOptional() lastEventHint!: string | null;
  @ApiProperty() lastCausationId!: string;
  @ApiProperty() startedAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiPropertyOptional() endedAt!: string | null;
  @ApiProperty() eventCount!: number;
  @ApiProperty() schemaVersion!: number;
  @ApiPropertyOptional() lastTopic!: string | null;
  @ApiPropertyOptional() lastPartition!: number | null;
  @ApiPropertyOptional() lastOffset!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() version!: number;
}

export function toSagaStateDto(record: SagaStateRecord): SagaStateDto {
  return {
    sagaId: record.sagaId,
    sagaRootId: record.sagaRootId,
    sagaParentId: record.sagaParentId,
    sagaName: record.sagaName,
    sagaDescription: record.sagaDescription,
    status: record.status,
    currentStepName: record.currentStepName,
    currentStepDescription: record.currentStepDescription,
    lastEventId: record.lastEventId,
    lastEventHint: record.lastEventHint,
    lastCausationId: record.lastCausationId,
    startedAt: record.startedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
    eventCount: record.eventCount,
    schemaVersion: record.schemaVersion,
    lastTopic: record.lastTopic,
    lastPartition: record.lastPartition,
    lastOffset: record.lastOffset,
    createdAt: record.createdAt.toISOString(),
    version: record.version,
  };
}
