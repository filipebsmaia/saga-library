import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Logger } from '@core/common/application/logger';

@Injectable()
export class PinoLoggerAdapter extends Logger {
  constructor(private readonly pino: PinoLogger) {
    super();
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.pino.debug(context ?? {}, message);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.pino.info(context ?? {}, message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.pino.warn(context ?? {}, message);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.pino.error(context ?? {}, message);
  }
}
