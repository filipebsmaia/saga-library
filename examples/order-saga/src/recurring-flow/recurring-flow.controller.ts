import { Controller, Post, Get, Query, Param, Logger, BadRequestException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { SagaPublisherProvider } from '@saga/nestjs';
import { RFRecurringStore } from './stores/recurring.store';
import { RFPlanStore } from './stores/plan.store';
import { RFPlanOrderStore } from './stores/plan-order.store';
import { RFOrderStore } from './stores/order.store';
import { RFPaymentStore } from './stores/payment.store';
import { RFProductStore } from './stores/product.store';
import { RFProvisionStore } from './stores/provision.store';

@Controller('recurring-flow')
export class RecurringFlowController {
  private readonly logger = new Logger(RecurringFlowController.name);

  constructor(
    private readonly sagaPublisher: SagaPublisherProvider,
    private readonly recurringStore: RFRecurringStore,
    private readonly planStore: RFPlanStore,
    private readonly planOrderStore: RFPlanOrderStore,
    private readonly orderStore: RFOrderStore,
    private readonly paymentStore: RFPaymentStore,
    private readonly productStore: RFProductStore,
    private readonly provisionStore: RFProvisionStore,
  ) {}

  @Post('billing')
  async triggerBilling(
    @Query('paymentFail') paymentFail?: string,
    @Query('maxAttempts') maxAttemptsParam?: string,
  ) {
    const recurringId = uuidv7();
    const planId = `PLAN-${uuidv7().slice(0, 8).toUpperCase()}`;
    const customerId = `CUST-${Date.now().toString(36).toUpperCase()}`;
    const amount = 89.9;
    const cycle = 1;
    const maxAttempts = Math.max(1, parseInt(maxAttemptsParam ?? '3', 10));
    const scheduledTo = new Date().toISOString();

    // Create plan
    this.planStore.create(planId, {
      customerId,
      planName: 'Plano Móvel 50GB',
    });

    // Create recurring as SCHEDULED
    this.recurringStore.create(recurringId, '', {
      planId,
      customerId,
      amount,
      cycle,
      maxAttempts,
      scheduledTo,
    });

    // Increment attempt (SCHEDULED → PROCESSING)
    this.recurringStore.incrementAttempt(recurringId);

    const { sagaId } = await this.sagaPublisher.start(
      async () => {
        await this.sagaPublisher.emit({
          eventType: 'rf.recurring.updated.processing',
          stepName: 'trigger-recurring',
          stepDescription: 'CRON run-queue publica RECURRING_UPDATED (PROCESSING)',
          payload: {
            recurringId,
            planId,
            customerId,
            amount,
            cycle,
            simulatePaymentFailure: paymentFail === 'true',
          },
        });
      },
      {
        sagaName: 'Recorrência de Plano',
        sagaDescription: 'Ciclo de cobrança recorrente do plano móvel',
      },
    );

    this.recurringStore.updateSagaId(recurringId, sagaId);

    this.logger.log(
      `Billing saga ${sagaId} started for recurring ${recurringId} (attempt 1/${maxAttempts})`,
    );

    return {
      recurringId,
      sagaId,
      planId,
      customerId,
      amount,
      cycle,
      maxAttempts,
      status: 'PROCESSING',
    };
  }

  @Post('retry/:recurringId')
  async retryRecurring(
    @Param('recurringId') recurringId: string,
    @Query('paymentFail') paymentFail?: string,
  ) {
    const record = this.recurringStore.findOne(recurringId);

    if (!record) {
      throw new BadRequestException(`Recurring ${recurringId} not found`);
    }

    if (record.status === 'FAILED') {
      throw new BadRequestException(
        `Recurring ${recurringId} already FAILED (max attempts exceeded)`,
      );
    }

    if (record.status === 'COMPLETED') {
      throw new BadRequestException(`Recurring ${recurringId} already COMPLETED`);
    }

    if (record.status !== 'CAPTURE_FAILED') {
      throw new BadRequestException(
        `Recurring ${recurringId} status is ${record.status}, expected CAPTURE_FAILED`,
      );
    }

    // Increment attempt (CAPTURE_FAILED → PROCESSING)
    this.recurringStore.incrementAttempt(recurringId);

    const { sagaId } = await this.sagaPublisher.start(
      async () => {
        await this.sagaPublisher.emit({
          eventType: 'rf.recurring.updated.processing',
          stepName: 'retry-recurring',
          stepDescription: `CRON run-queue retenta recorrência (tentativa ${record.totalAttempts}/${record.maxAttempts})`,
          payload: {
            recurringId,
            planId: record.planId,
            customerId: record.customerId,
            amount: record.amount,
            cycle: record.cycle,
            simulatePaymentFailure: paymentFail === 'true',
          },
        });
      },
      {
        sagaName: 'Recorrência de Plano (retry)',
        sagaDescription: `Retentativa ${record.totalAttempts}/${record.maxAttempts}`,
      },
    );

    this.recurringStore.updateSagaId(recurringId, sagaId);

    this.logger.log(
      `Retry saga ${sagaId} started for recurring ${recurringId} (attempt ${record.totalAttempts}/${record.maxAttempts})`,
    );

    return {
      recurringId,
      sagaId,
      attempt: record.totalAttempts,
      maxAttempts: record.maxAttempts,
      status: 'PROCESSING',
    };
  }

  @Get('recurrings')
  listRecurrings() {
    return this.recurringStore.findAll();
  }

  @Get('plans')
  listPlans() {
    return this.planStore.findAll();
  }

  @Get('orders')
  listOrders() {
    return {
      planOrders: this.planOrderStore.findAll(),
      orders: this.orderStore.findAll(),
    };
  }

  @Get('payments')
  listPayments() {
    return this.paymentStore.findAll();
  }

  @Get('products')
  listProducts() {
    return this.productStore.findAll();
  }

  @Get('provisions')
  listProvisions() {
    return this.provisionStore.findAll();
  }
}
