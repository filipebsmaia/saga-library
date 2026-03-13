import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { MetricsModule } from '../metrics/metrics.module';
import { PrismaService } from '@core/saga/infra/prisma/prisma.service';
import { PrismaManager } from '@core/saga/infra/prisma/prisma-manager';
import { PrismaSagaStateRepository } from '@core/saga/infra/prisma/prisma-saga-state.repository';
import { PrismaSagaEventLogRepository } from '@core/saga/infra/prisma/prisma-saga-event-log.repository';
import { PrismaSagaDashboardService } from '@core/saga/infra/prisma/prisma-saga-dashboard.service';
import { SagaStateRepository } from '@core/saga/domain/repositories/saga-state.repository';
import { SagaEventLogRepository } from '@core/saga/domain/repositories/saga-event-log.repository';
import { SagaDashboardService } from '@core/saga/domain/services/saga-dashboard.service';
import { UnitOfWork } from '@core/common/application/unit-of-work';
import { PrismaUnitOfWork } from '@core/common/infra/unit-of-work-prisma';
import { Logger } from '@core/common/application/logger';
import { Metrics } from '@core/common/application/metrics';
import { BatchObserverHub } from '@core/common/application/batch-observer-hub';
import { MetricsBatchObserver } from '../metrics/metrics-batch.observer';
import { LoggerBatchObserver } from '../logger/logger-batch.observer';
import { RedisService } from '@core/saga/infra/redis/redis.service';
import { CacheService } from '@core/saga/application/cache.service';
import { RedisCacheService } from '@core/saga/infra/redis/redis-cache.service';
import { SagaPublisher } from '@core/saga/application/saga-publisher';
import { RedisPublisherService } from '@core/saga/infra/redis/redis-publisher.service';
import { KafkaProjectorService } from '@core/saga/infra/kafka/kafka-projector.service';
import { ParseBatchCommand } from '@core/saga/application/commands/parse-batch.command';
import { DedupeEventsCommand } from '@core/saga/application/commands/dedupe-events.command';
import { LookupStatesCommand } from '@core/saga/application/commands/lookup-states.command';
import { DeriveChangesCommand } from '@core/saga/application/commands/derive-changes.command';
import { PersistBatchCommand } from '@core/saga/application/commands/persist-batch.command';
import { PublishUpdatesCommand } from '@core/saga/application/commands/publish-updates.command';
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
import { SagaController } from './controllers/saga.controller';
import { SagaStreamController } from './controllers/saga-stream.controller';

@Module({
  imports: [LoggerModule, MetricsModule],
  providers: [
    PrismaService,
    PrismaManager,
    RedisService,
    {
      provide: SagaPublisher,
      useFactory: (redis: RedisService) => new RedisPublisherService(redis),
      inject: [RedisService],
    },

    // UnitOfWork
    {
      provide: UnitOfWork,
      useFactory: (prisma: PrismaManager) => new PrismaUnitOfWork(prisma),
      inject: [PrismaManager],
    },

    // Cache
    {
      provide: CacheService,
      useFactory: (redis: RedisService) => new RedisCacheService(redis),
      inject: [RedisService],
    },

    // Repositories
    {
      provide: SagaStateRepository,
      useFactory: (prisma: PrismaManager) => new PrismaSagaStateRepository(prisma),
      inject: [PrismaManager],
    },
    {
      provide: SagaEventLogRepository,
      useFactory: (prisma: PrismaManager) => new PrismaSagaEventLogRepository(prisma),
      inject: [PrismaManager],
    },

    // Dashboard analytics
    {
      provide: SagaDashboardService,
      useFactory: (prisma: PrismaManager) => new PrismaSagaDashboardService(prisma),
      inject: [PrismaManager],
    },

    // Commands
    {
      provide: ParseBatchCommand,
      useFactory: () => new ParseBatchCommand(),
    },
    {
      provide: DedupeEventsCommand,
      useFactory: (eventLogRepo: SagaEventLogRepository) => new DedupeEventsCommand(eventLogRepo),
      inject: [SagaEventLogRepository],
    },
    {
      provide: LookupStatesCommand,
      useFactory: (stateRepo: SagaStateRepository) => new LookupStatesCommand(stateRepo),
      inject: [SagaStateRepository],
    },
    {
      provide: DeriveChangesCommand,
      useFactory: () => new DeriveChangesCommand(),
    },
    {
      provide: PersistBatchCommand,
      useFactory: (stateRepo: SagaStateRepository, eventLogRepo: SagaEventLogRepository, uow: UnitOfWork, logger: Logger) =>
        new PersistBatchCommand(stateRepo, eventLogRepo, uow, logger),
      inject: [SagaStateRepository, SagaEventLogRepository, UnitOfWork, Logger],
    },
    {
      provide: PublishUpdatesCommand,
      useFactory: (publisher: SagaPublisher) => new PublishUpdatesCommand(publisher),
      inject: [SagaPublisher],
    },

    // Observers
    {
      provide: MetricsBatchObserver,
      useFactory: (metrics: Metrics) => new MetricsBatchObserver(metrics),
      inject: [Metrics],
    },
    {
      provide: LoggerBatchObserver,
      useFactory: (logger: Logger) => new LoggerBatchObserver(logger),
      inject: [Logger],
    },
    {
      provide: BatchObserverHub,
      useFactory: (metricsObs: MetricsBatchObserver, loggerObs: LoggerBatchObserver) =>
        new BatchObserverHub([metricsObs, loggerObs]),
      inject: [MetricsBatchObserver, LoggerBatchObserver],
    },

    // Kafka Projector
    {
      provide: KafkaProjectorService,
      useFactory: (
        config: ConfigService,
        logger: Logger,
        observers: BatchObserverHub,
        parseBatch: ParseBatchCommand,
        dedupeEvents: DedupeEventsCommand,
        lookupStates: LookupStatesCommand,
        deriveChanges: DeriveChangesCommand,
        persistBatch: PersistBatchCommand,
        publishUpdates: PublishUpdatesCommand,
      ) =>
        new KafkaProjectorService(
          config, logger, observers, parseBatch, dedupeEvents, lookupStates, deriveChanges, persistBatch, publishUpdates,
        ),
      inject: [
        ConfigService,
        Logger,
        BatchObserverHub,
        ParseBatchCommand,
        DedupeEventsCommand,
        LookupStatesCommand,
        DeriveChangesCommand,
        PersistBatchCommand,
        PublishUpdatesCommand,
      ],
    },

    // Queries
    {
      provide: ListSagasQuery,
      useFactory: (repo: SagaStateRepository) => new ListSagasQuery(repo),
      inject: [SagaStateRepository],
    },
    {
      provide: GetDashboardStatsQuery,
      useFactory: (dashboard: SagaDashboardService, cache: CacheService) =>
        new GetDashboardStatsQuery(dashboard, cache),
      inject: [SagaDashboardService, CacheService],
    },
    {
      provide: GetAttentionItemsQuery,
      useFactory: (repo: SagaStateRepository) =>
        new GetAttentionItemsQuery(repo),
      inject: [SagaStateRepository],
    },
    {
      provide: GetSagaDetailQuery,
      useFactory: (repo: SagaStateRepository) => new GetSagaDetailQuery(repo),
      inject: [SagaStateRepository],
    },
    {
      provide: GetSagaEventsQuery,
      useFactory: (eventRepo: SagaEventLogRepository, stateRepo: SagaStateRepository) =>
        new GetSagaEventsQuery(eventRepo, stateRepo),
      inject: [SagaEventLogRepository, SagaStateRepository],
    },
    {
      provide: GetSagaTreeQuery,
      useFactory: (repo: SagaStateRepository) => new GetSagaTreeQuery(repo),
      inject: [SagaStateRepository],
    },
    {
      provide: GetSagaMetricsQuery,
      useFactory: (stateRepo: SagaStateRepository, eventRepo: SagaEventLogRepository) =>
        new GetSagaMetricsQuery(stateRepo, eventRepo),
      inject: [SagaStateRepository, SagaEventLogRepository],
    },
    {
      provide: GetTopStepsQuery,
      useFactory: (repo: SagaEventLogRepository) => new GetTopStepsQuery(repo),
      inject: [SagaEventLogRepository],
    },
    {
      provide: GetTopTypesQuery,
      useFactory: (dashboard: SagaDashboardService, redis: CacheService) => new GetTopTypesQuery(dashboard, redis),
      inject: [SagaDashboardService, CacheService],
    },
    {
      provide: GetSagaPredictionsQuery,
      useFactory: (stateRepo: SagaStateRepository, eventRepo: SagaEventLogRepository) =>
        new GetSagaPredictionsQuery(stateRepo, eventRepo),
      inject: [SagaStateRepository, SagaEventLogRepository],
    },
  ],
  controllers: [SagaController, SagaStreamController],
})
export class SagaModule {}
