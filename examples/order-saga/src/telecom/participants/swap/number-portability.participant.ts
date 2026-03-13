import { Injectable, Logger } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from '@saga/nestjs';
import type { IncomingEvent, Emit } from '@saga/nestjs';
import { randomDelay } from '../../delay';

@Injectable()
@SagaParticipant()
export class NumberPortabilityParticipant extends SagaParticipantBase {
  readonly serviceId = 'number-portability';
  private readonly logger = new Logger(NumberPortabilityParticipant.name);

  @SagaHandler('portability.validation.requested', { final: true })
  async handleValidationRequested(event: IncomingEvent, emit: Emit): Promise<void> {
    const { swapId, msisdn, newIccid } = event.payload as {
      swapId: string;
      msisdn: string;
      newIccid: string;
    };

    await randomDelay();

    this.logger.log(`Validating portability for MSISDN ${msisdn} (swap: ${swapId})`);

    await emit({
      eventType: 'portability.validated',
      stepName: 'validate-portability',
      payload: { swapId, msisdn, newIccid, valid: true, validatedAt: new Date().toISOString() },
    });

    this.logger.log(`Portability validated for MSISDN ${msisdn}`);
  }
}
