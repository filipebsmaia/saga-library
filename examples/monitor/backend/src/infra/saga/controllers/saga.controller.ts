import { Controller, Get, Param, Query, NotFoundException, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ListSagasQuery } from '@core/saga/application/queries/list-sagas.query';
import { GetSagaDetailQuery } from '@core/saga/application/queries/get-saga-detail.query';
import { GetSagaEventsQuery } from '@core/saga/application/queries/get-saga-events.query';
import { GetSagaTreeQuery } from '@core/saga/application/queries/get-saga-tree.query';
import { GetSagaMetricsQuery } from '@core/saga/application/queries/get-saga-metrics.query';
import { GetDashboardStatsQuery } from '@core/saga/application/queries/get-dashboard-stats.query';
import { GetAttentionItemsQuery } from '@core/saga/application/queries/get-attention-items.query';
import { GetTopStepsQuery } from '@core/saga/application/queries/get-top-steps.query';
import { GetTopTypesQuery } from '@core/saga/application/queries/get-top-types.query';
import { GetSagaPredictionsQuery } from '@core/saga/application/queries/get-saga-predictions.query';
import { ListSagasQueryDto } from '@core/saga/application/dtos/list-sagas.dto';
import { ListSagaEventsQueryDto } from '@core/saga/application/dtos/list-saga-events.dto';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@ApiTags('Sagas')
@Controller({ path: 'sagas', version: '1' })
export class SagaController {
  constructor(
    private readonly listSagasQuery: ListSagasQuery,
    private readonly getSagaDetailQuery: GetSagaDetailQuery,
    private readonly getSagaEventsQuery: GetSagaEventsQuery,
    private readonly getSagaTreeQuery: GetSagaTreeQuery,
    private readonly getSagaMetricsQuery: GetSagaMetricsQuery,
    private readonly getDashboardStatsQuery: GetDashboardStatsQuery,
    private readonly getAttentionItemsQuery: GetAttentionItemsQuery,
    private readonly getTopStepsQuery: GetTopStepsQuery,
    private readonly getTopTypesQuery: GetTopTypesQuery,
    private readonly getSagaPredictionsQuery: GetSagaPredictionsQuery,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List sagas with filters and cursor pagination' })
  async list(@Query() dto: ListSagasQueryDto) {
    return this.listSagasQuery.execute({
      status: dto.status,
      sagaName: dto.sagaName,
      sagaRootId: dto.sagaRootId,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      rootsOnly: dto.rootsOnly,
      activeOnly: dto.activeOnly,
      compensating: dto.compensating,
      stuck: dto.stuck,
      cursor: dto.cursor,
      limit: dto.limit,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system-wide dashboard stats' })
  async stats() {
    return this.getDashboardStatsQuery.execute();
  }

  @Get('attention')
  @ApiOperation({ summary: 'Get sagas needing attention' })
  async attention() {
    return this.getAttentionItemsQuery.execute();
  }

  @Get('top-steps')
  @ApiOperation({ summary: 'Get slowest steps (last 24h)' })
  async topSteps() {
    return this.getTopStepsQuery.execute();
  }

  @Get('top-types')
  @ApiOperation({ summary: 'Get top saga types by volume (last 24h)' })
  async topTypes() {
    return this.getTopTypesQuery.execute();
  }

  @Get(':sagaId')
  @ApiOperation({ summary: 'Get saga detail by ID' })
  async detail(@Param('sagaId') sagaId: string) {
    const result = await this.getSagaDetailQuery.execute(sagaId);
    if (!result) {
      throw new NotFoundException(`Saga ${sagaId} not found`);
    }
    return result;
  }

  @Get(':sagaId/events')
  @ApiOperation({ summary: 'Get saga event timeline' })
  async events(@Param('sagaId') sagaId: string, @Query() dto: ListSagaEventsQueryDto) {
    return this.getSagaEventsQuery.execute(sagaId, dto.cursor, dto.limit);
  }

  @Get('root/:rootId')
  @ApiOperation({ summary: 'Get saga tree by root ID' })
  async tree(@Param('rootId') rootId: string) {
    return this.getSagaTreeQuery.execute(rootId);
  }

  @Get(':sagaId/metrics')
  @ApiOperation({ summary: 'Get saga execution metrics' })
  async metrics(@Param('sagaId') sagaId: string) {
    const result = await this.getSagaMetricsQuery.execute(sagaId);
    if (!result) {
      throw new NotFoundException(`Saga ${sagaId} not found`);
    }
    return result;
  }

  @Get(':sagaId/predictions')
  @ApiOperation({ summary: 'Get predicted next events for a running saga' })
  @ApiResponse({ status: 200, description: 'Predicted events based on historical patterns' })
  async predictions(@Param('sagaId') sagaId: string) {
    const result = await this.getSagaPredictionsQuery.execute(sagaId);
    if (!result) {
      throw new NotFoundException(`Saga ${sagaId} not found`);
    }
    return result;
  }
}
