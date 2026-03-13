import { Controller, Post, Get, Query, Logger } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import { SagaPublisherProvider } from "@fbsm/saga-nestjs";
import { RecurringStore } from "./stores/recurring.store";
import { OrderStore } from "./stores/order.store";
import { ProductStore } from "./stores/product.store";
import { SimSwapStore } from "./stores/sim-swap.store";
import { BulkActivationStore } from "./stores/bulk-activation.store";
import { UpgradeStore } from "./stores/upgrade.store";
import { ProvisioningStore } from "./stores/provisioning.store";

@Controller()
export class TelecomController {
  private readonly logger = new Logger(TelecomController.name);

  constructor(
    private readonly sagaPublisher: SagaPublisherProvider,
    private readonly recurringStore: RecurringStore,
    private readonly orderStore: OrderStore,
    private readonly productStore: ProductStore,
    private readonly simSwapStore: SimSwapStore,
    private readonly bulkActivationStore: BulkActivationStore,
    private readonly upgradeStore: UpgradeStore,
    private readonly provisioningStore: ProvisioningStore,
  ) {}

  @Post("recurrings")
  async triggerRecurring(
    @Query("paymentFail") paymentFail?: string,
    @Query("transient") transient?: string,
  ) {
    const recurringId = uuidv7();
    const planId = "PLAN-MOBILE-50GB";
    const customerId = `CUST-${Date.now().toString(36).toUpperCase()}`;
    const amount = 49.9;
    const cycle = 1;

    const { sagaId } = await this.sagaPublisher.start(
      async () => {
        await this.sagaPublisher.emit({
          eventType: "recurring.triggered",
          stepName: "Trigger Recurring cycle",
          stepDescription: "Trigger recurring billing cycle",
          payload: {
            recurringId,
            planId,
            customerId,
            amount,
            cycle,
            simulatePaymentFailure: paymentFail === "true",
            simulateTransient: transient === "true",
          },
        });
      },
      {
        sagaName: "Cobrança Recorrente",
        sagaDescription: "Ciclo mensal de cobrança do plano móvel",
      },
    );

    this.recurringStore.create(recurringId, sagaId, {
      planId,
      customerId,
      amount,
      cycle,
    });

    this.logger.log(`Saga ${sagaId} started for recurring ${recurringId}`);

    return { recurringId, sagaId, status: "TRIGGERED" };
  }

  @Get("recurrings")
  listRecurrings() {
    return this.recurringStore.findAll();
  }

  @Get("orders")
  listOrders() {
    return this.orderStore.findAll();
  }

  @Get("products")
  listProducts() {
    return this.productStore.findAll();
  }

  // --- Scenario: SIM Swap (parent → sub-saga → parent resumes) ---

  @Post("sim-swaps")
  async triggerSimSwap() {
    const swapId = uuidv7();
    const msisdn = `+5511${Date.now().toString().slice(-8)}`;
    const newIccid = `ICCID-${Date.now().toString(36).toUpperCase()}`;

    const { sagaId } = await this.sagaPublisher.start(
      async () => {
        await this.sagaPublisher.emit({
          eventType: "sim-swap.requested",
          stepName: "Request Sim Swap",
          stepDescription: "Request SIM card swap with portability validation",
          payload: { swapId, msisdn, newIccid },
        });
      },
      {
        sagaName: "sim-swap",
        sagaDescription: "SIM card swap with portability check",
      },
    );

    this.simSwapStore.create(swapId, sagaId, { msisdn, newIccid });

    this.logger.log(`SIM swap saga ${sagaId} started for swap ${swapId}`);

    return { swapId, sagaId, msisdn, newIccid, status: "REQUESTED" };
  }

  @Get("sim-swaps")
  listSimSwaps() {
    return this.simSwapStore.findAll();
  }

  // --- Scenario: Bulk Activation (fan-out N sub-sagas / fan-in) ---

  @Post("bulk-activations")
  async triggerBulkActivation(@Query("lines") linesParam?: string) {
    const lines = Math.max(1, Math.min(10, parseInt(linesParam ?? "3", 10)));
    const bulkId = uuidv7();

    const { sagaId } = await this.sagaPublisher.start(
      async () => {
        await this.sagaPublisher.emit({
          eventType: "bulk-activation.requested",
          stepName: "Request Bulk Activation",
          stepDescription: "Request bulk line activation batch",
          payload: { bulkId, lines },
        });
      },
      {
        sagaName: "bulk-activation",
        sagaDescription: "Bulk SIM line activation batch",
      },
    );

    this.bulkActivationStore.create(bulkId, sagaId, { totalLines: lines });

    this.logger.log(
      `Bulk activation saga ${sagaId} started for ${lines} lines`,
    );

    return { bulkId, sagaId, lines, status: "REQUESTED" };
  }

  @Get("bulk-activations")
  listBulkActivations() {
    return this.bulkActivationStore.findAll();
  }

  // --- Scenario: Plan Upgrade (derived saga with independent compensation) ---

  @Post("upgrades")
  async triggerUpgrade(@Query("fail") fail?: string) {
    const upgradeId = uuidv7();
    const customerId = `CUST-${Date.now().toString(36).toUpperCase()}`;
    const currentPlan = "PLAN-MOBILE-10GB";
    const targetPlan = "PLAN-MOBILE-50GB";

    const { sagaId } = await this.sagaPublisher.start(
      async () => {
        await this.sagaPublisher.emit({
          eventType: "upgrade.requested",
          stepName: "Request Plan Upgrade",
          stepDescription: "Customer requested a plan upgrade",
          payload: {
            upgradeId,
            customerId,
            currentPlan,
            targetPlan,
            simulateFailure: fail === "true",
          },
        });
      },
      {
        sagaName: "Upgrade de Plano",
        sagaDescription: `Upgrade ${currentPlan} → ${targetPlan}`,
      },
    );

    this.upgradeStore.create(upgradeId, sagaId, {
      customerId,
      currentPlan,
      targetPlan,
    });

    this.logger.log(`Upgrade saga ${sagaId} started for upgrade ${upgradeId}`);

    return {
      upgradeId,
      sagaId,
      customerId,
      currentPlan,
      targetPlan,
      status: "REQUESTED",
    };
  }

  @Get("upgrades")
  listUpgrades() {
    return this.upgradeStore.findAll();
  }

  // --- Scenario: Device Provisioning (long-running handler + manual heartbeat) ---

  @Post("provisionings")
  async triggerProvisioning() {
    const provisioningId = uuidv7();
    const deviceSerial = `DEV-${Date.now().toString(36).toUpperCase()}`;

    const { sagaId } = await this.sagaPublisher.start(
      async () => {
        await this.sagaPublisher.emit({
          eventType: "device-provisioning.requested",
          stepName: "Request Device Provisioning",
          stepDescription:
            "Start long-running device provisioning with manual heartbeat",
          payload: { provisioningId, deviceSerial },
        });
      },
      {
        sagaName: "device-provisioning",
        sagaDescription: `Provision device ${deviceSerial}`,
      },
    );

    this.provisioningStore.create(provisioningId, sagaId, deviceSerial);

    this.logger.log(
      `Provisioning saga ${sagaId} started for device ${deviceSerial}`,
    );

    return { provisioningId, sagaId, deviceSerial, status: "REQUESTED" };
  }

  @Get("provisionings")
  listProvisionings() {
    return this.provisioningStore.findAll();
  }
}
