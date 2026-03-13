import { Module } from '@nestjs/common';
import { TelecomController } from './telecom.controller';
import { RecurringStore } from './stores/recurring.store';
import { OrderStore } from './stores/order.store';
import { ProductStore } from './stores/product.store';
import { SimSwapStore } from './stores/sim-swap.store';
import { BulkActivationStore } from './stores/bulk-activation.store';

// Recurring flow
import { PlanRecurringManagementParticipant } from './participants/recurring/plan-recurring-management.participant';
import { PlanManagementParticipant } from './participants/recurring/plan-management.participant';
import { PlanOrderingManagementParticipant } from './participants/recurring/plan-ordering-management.participant';
import { OrderingManagementParticipant } from './participants/recurring/ordering-management.participant';
import { PaymentManagementParticipant } from './participants/recurring/payment-management.participant';
import { MobileProductLifecycleParticipant } from './participants/recurring/mobile-product-lifecycle.participant';
import { MobileProductProvisionParticipant } from './participants/recurring/mobile-product-provision.participant';

// SIM Swap flow
import { SimSwapOrchestrationParticipant } from './participants/swap/sim-swap-orchestration.participant';
import { NumberPortabilityParticipant } from './participants/swap/number-portability.participant';

// Bulk Activation flow
import { BulkActivationOrchestrationParticipant } from './participants/activation/bulk-activation-orchestration.participant';
import { LineActivationParticipant } from './participants/activation/line-activation.participant';

// Upgrade flow
import { UpgradeEligibilityParticipant } from './participants/upgrade/upgrade-eligibility.participant';
import { UpgradeApprovalParticipant } from './participants/upgrade/upgrade-approval.participant';
import { MigrationProvisioningParticipant } from './participants/upgrade/migration-provisioning.participant';
import { MigrationActivationParticipant } from './participants/upgrade/migration-activation.participant';
import { MigrationRollbackParticipant } from './participants/upgrade/migration-rollback.participant';
import { UpgradeStore } from './stores/upgrade.store';

@Module({
  controllers: [TelecomController],
  providers: [
    RecurringStore,
    OrderStore,
    ProductStore,
    SimSwapStore,
    BulkActivationStore,

    // Recurring flow
    PlanRecurringManagementParticipant,
    PlanManagementParticipant,
    PlanOrderingManagementParticipant,
    OrderingManagementParticipant,
    PaymentManagementParticipant,
    MobileProductLifecycleParticipant,
    MobileProductProvisionParticipant,

    // SIM Swap flow
    SimSwapOrchestrationParticipant,
    NumberPortabilityParticipant,

    // Bulk Activation flow
    BulkActivationOrchestrationParticipant,
    LineActivationParticipant,

    // Upgrade flow
    UpgradeStore,
    UpgradeEligibilityParticipant,
    UpgradeApprovalParticipant,
    MigrationProvisioningParticipant,
    MigrationActivationParticipant,
    MigrationRollbackParticipant,
  ],
})
export class TelecomModule {}
