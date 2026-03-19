import { Module } from "@nestjs/common";
import { TelecomController } from "./telecom.controller";
import { RecurringStore } from "./stores/recurring.store";
import { OrderStore } from "./stores/order.store";
import { ProductStore } from "./stores/product.store";
import { SimSwapStore } from "./stores/sim-swap.store";
import { BulkActivationStore } from "./stores/bulk-activation.store";

// Recurring flow
import {
  PlanOrderCompletedParticipant,
  PlanOrderFailedParticipant,
} from "./participants/recurring/plan-recurring-management.participant";
import { PlanManagementParticipant } from "./participants/recurring/plan-management.participant";
import {
  PlanOrderRequestedParticipant,
  OrderCompletedBridgeParticipant,
  OrderFailedBridgeParticipant,
} from "./participants/recurring/plan-ordering-management.participant";
import {
  OrderRequestedParticipant,
  PaymentApprovedParticipant,
  PaymentRejectedParticipant,
} from "./participants/recurring/ordering-management.participant";
import { PaymentManagementParticipant } from "./participants/recurring/payment-management.participant";
import {
  RecurringCreatedParticipant,
  ProductProvisionedParticipant,
} from "./participants/recurring/mobile-product-lifecycle.participant";
import { MobileProductProvisionParticipant } from "./participants/recurring/mobile-product-provision.participant";

// SIM Swap flow
import {
  SimSwapForkParticipant,
  PortabilityValidatedParticipant,
} from "./participants/swap/sim-swap-orchestration.participant";
import { NumberPortabilityParticipant } from "./participants/swap/number-portability.participant";

// Bulk Activation flow
import {
  BulkActivationForkParticipant,
  LineActivationCompletedParticipant,
} from "./participants/activation/bulk-activation-orchestration.participant";
import { LineActivationParticipant } from "./participants/activation/line-activation.participant";

// Upgrade flow
import { UpgradeEligibilityParticipant } from "./participants/upgrade/upgrade-eligibility.participant";
import { UpgradeApprovalParticipant } from "./participants/upgrade/upgrade-approval.participant";
import { MigrationProvisioningParticipant } from "./participants/upgrade/migration-provisioning.participant";
import { MigrationActivationParticipant } from "./participants/upgrade/migration-activation.participant";
import { MigrationRollbackParticipant } from "./participants/upgrade/migration-rollback.participant";
import { UpgradeStore } from "./stores/upgrade.store";

// Provisioning flow (heartbeat demo)
import { DeviceProvisioningParticipant } from "./participants/provisioning/device-provisioning.participant";
import { ProvisioningStore } from "./stores/provisioning.store";

@Module({
  controllers: [TelecomController],
  providers: [
    RecurringStore,
    OrderStore,
    ProductStore,
    SimSwapStore,
    BulkActivationStore,

    // Recurring flow
    PlanOrderCompletedParticipant,
    PlanOrderFailedParticipant,
    PlanManagementParticipant,
    PlanOrderRequestedParticipant,
    OrderCompletedBridgeParticipant,
    OrderFailedBridgeParticipant,
    OrderRequestedParticipant,
    PaymentApprovedParticipant,
    PaymentRejectedParticipant,
    PaymentManagementParticipant,
    RecurringCreatedParticipant,
    ProductProvisionedParticipant,
    MobileProductProvisionParticipant,

    // SIM Swap flow
    SimSwapForkParticipant,
    PortabilityValidatedParticipant,
    NumberPortabilityParticipant,

    // Bulk Activation flow
    BulkActivationForkParticipant,
    LineActivationCompletedParticipant,
    LineActivationParticipant,

    // Upgrade flow
    UpgradeStore,
    UpgradeEligibilityParticipant,
    UpgradeApprovalParticipant,
    MigrationProvisioningParticipant,
    MigrationActivationParticipant,
    MigrationRollbackParticipant,

    // Provisioning flow (heartbeat demo)
    ProvisioningStore,
    DeviceProvisioningParticipant,
  ],
})
export class TelecomModule {}
