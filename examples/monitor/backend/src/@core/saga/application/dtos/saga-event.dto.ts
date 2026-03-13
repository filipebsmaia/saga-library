import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SagaEventLogRecord } from '../../domain/repositories/saga-event-log.repository';

export class SagaEventDto {
  @ApiProperty() sagaEventId!: string;
  @ApiProperty() sagaId!: string;
  @ApiProperty() sagaRootId!: string;
  @ApiPropertyOptional() sagaParentId!: string | null;
  @ApiProperty() sagaCausationId!: string;
  @ApiPropertyOptional() sagaName!: string | null;
  @ApiProperty() sagaStepName!: string;
  @ApiPropertyOptional() sagaStepDescription!: string | null;
  @ApiPropertyOptional() sagaEventHint!: string | null;
  @ApiProperty() sagaPublishedAt!: string;
  @ApiPropertyOptional() statusBefore!: string | null;
  @ApiProperty() statusAfter!: string;
  @ApiProperty() topic!: string;
  @ApiPropertyOptional() partition!: number | null;
  @ApiPropertyOptional() offset!: string | null;
  @ApiProperty() createdAt!: string;
}

export function toSagaEventDto(record: SagaEventLogRecord): SagaEventDto {
  return {
    sagaEventId: record.sagaEventId,
    sagaId: record.sagaId,
    sagaRootId: record.sagaRootId,
    sagaParentId: record.sagaParentId,
    sagaCausationId: record.sagaCausationId,
    sagaName: record.sagaName,
    sagaStepName: record.sagaStepName,
    sagaStepDescription: record.sagaStepDescription,
    sagaEventHint: record.sagaEventHint,
    sagaPublishedAt: record.sagaPublishedAt.toISOString(),
    statusBefore: record.statusBefore,
    statusAfter: record.statusAfter,
    topic: record.topic,
    partition: record.partition,
    offset: record.offset,
    createdAt: record.createdAt.toISOString(),
  };
}
