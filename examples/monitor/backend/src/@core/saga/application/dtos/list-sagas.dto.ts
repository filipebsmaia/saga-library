import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, IsDateString, IsBoolean, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SagaStatus } from '../../domain/types/saga-status.enum';

export class ListSagasQueryDto {
  @ApiPropertyOptional({ enum: SagaStatus })
  @IsOptional()
  @IsEnum(SagaStatus)
  status?: SagaStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sagaName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sagaRootId?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Show only root sagas (no parent)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  rootsOnly?: boolean;

  @ApiPropertyOptional({ description: 'Show only non-completed sagas' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Show only COMPENSATING sagas' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  compensating?: boolean;

  @ApiPropertyOptional({ description: 'Show only stuck sagas (no updates for 5+ minutes)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  stuck?: boolean;

  @ApiPropertyOptional({ description: 'Cursor for pagination (sagaId)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
