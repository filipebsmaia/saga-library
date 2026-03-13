import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PredictedEventDto {
  @ApiProperty({ description: 'Expected step name' }) stepName!: string;
  @ApiPropertyOptional({ description: 'Expected event hint' }) eventHint!: string | null;
  @ApiPropertyOptional({ description: 'Expected topic' }) topic!: string | null;
  @ApiProperty({ description: 'Probability (0.0 - 1.0)' }) probability!: number;
}

export class SagaPredictionsDto {
  @ApiProperty() sagaId!: string;
  @ApiProperty() sagaName!: string;
  @ApiProperty() currentStep!: string;
  @ApiPropertyOptional() currentHint!: string | null;
  @ApiProperty({ type: [PredictedEventDto], description: 'All possible immediate next events' })
  nextPossible!: PredictedEventDto[];
  @ApiProperty({ type: [PredictedEventDto], description: 'Most likely path to completion' })
  expectedChain!: PredictedEventDto[];
  @ApiProperty({ description: 'Number of completed sagas used for prediction' }) sampleSize!: number;
}
