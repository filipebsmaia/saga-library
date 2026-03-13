import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { Logger } from '@core/common/application/logger';
import { PinoLoggerAdapter } from './pino-logger.adapter';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: false,
      },
    }),
  ],
  providers: [
    {
      provide: Logger,
      useClass: PinoLoggerAdapter,
    },
  ],
  exports: [Logger],
})
export class LoggerModule {}
