import { Module } from '@nestjs/common';
import { RecurringFlowController } from './recurring-flow.controller';

// Stores
import { RFRecurringStore } from './stores/recurring.store';
import { RFPlanStore } from './stores/plan.store';
import { RFPlanOrderStore } from './stores/plan-order.store';
import { RFOrderStore } from './stores/order.store';
import { RFPaymentStore } from './stores/payment.store';
import { RFProductStore } from './stores/product.store';
import { RFProvisionStore } from './stores/provision.store';

// Participants
import { RFPlanRecurringManagementParticipant } from './participants/plan-recurring-management.participant';
import { RFPlanManagementParticipant } from './participants/plan-management.participant';
import { RFPlanOrderingManagementParticipant } from './participants/plan-ordering-management.participant';
import { RFOrderingManagementParticipant } from './participants/ordering-management.participant';
import { RFPaymentManagementParticipant } from './participants/payment-management.participant';
import { RFMobileProductLifecycleParticipant } from './participants/mobile-product-lifecycle.participant';
import { RFMobileProductProvisionParticipant } from './participants/mobile-product-provision.participant';

@Module({
  controllers: [RecurringFlowController],
  providers: [
    // Stores
    RFRecurringStore,
    RFPlanStore,
    RFPlanOrderStore,
    RFOrderStore,
    RFPaymentStore,
    RFProductStore,
    RFProvisionStore,

    // Participants
    RFPlanRecurringManagementParticipant,
    RFPlanManagementParticipant,
    RFPlanOrderingManagementParticipant,
    RFOrderingManagementParticipant,
    RFPaymentManagementParticipant,
    RFMobileProductLifecycleParticipant,
    RFMobileProductProvisionParticipant,
  ],
})
export class RecurringFlowModule {}
