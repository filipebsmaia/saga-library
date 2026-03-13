import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SagaMetricsDto {
  @ApiProperty() sagaId!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ description: 'Elapsed time in ms since saga started' }) elapsedMs!: number;
  @ApiPropertyOptional({ description: 'Total duration in ms (if completed)' }) totalDurationMs!: number | null;
  @ApiProperty({ description: 'Time since last update in ms' }) lastUpdateAgoMs!: number;
  @ApiProperty() totalEvents!: number;
  @ApiProperty() compensationCount!: number;
  @ApiProperty() forkCount!: number;
  @ApiProperty() childSagaCount!: number;
  @ApiProperty({ description: 'Whether the saga appears stuck (no update beyond SLA)' }) isStuck!: boolean;
}
