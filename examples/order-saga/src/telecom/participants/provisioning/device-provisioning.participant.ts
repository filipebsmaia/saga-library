import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { getKafkaHeartbeat } from "@fbsm/saga-transport-kafka";
import { ProvisioningStore } from "../../stores/provisioning.store";

/**
 * Demonstrates manual heartbeat control using `getKafkaHeartbeat()`.
 *
 * Device provisioning involves 4 sequential steps (~8 s each = ~32 s total),
 * which would exceed the default Kafka `sessionTimeout` of 30 s without heartbeats.
 *
 * By calling `await heartbeat?.()` after each step we keep the consumer group alive
 * for the full duration without needing to increase `sessionTimeout`.
 *
 * For most handlers the automatic heartbeat (`autoHeartbeatInterval: 5000`, the default)
 * is sufficient and requires no code changes. Use manual heartbeats only when you need
 * fine-grained control over the checkpoint positions.
 */
@Injectable()
@SagaParticipant()
export class DeviceProvisioningParticipant extends SagaParticipantBase {
  readonly serviceId = "device-provisioning";
  private readonly logger = new Logger(DeviceProvisioningParticipant.name);

  constructor(private readonly provisioningStore: ProvisioningStore) {
    super();
  }

  @SagaHandler("device-provisioning.requested", { final: true })
  async handleProvisioningRequested(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const { provisioningId, deviceSerial } = event.payload as {
      provisioningId: string;
      deviceSerial: string;
    };

    // getKafkaHeartbeat() retrieves the KafkaJS heartbeat function via AsyncLocalStorage.
    // It returns undefined when called outside a KafkaJS consumer (e.g. unit tests),
    // so using optional chaining `?.()` is always safe.
    const heartbeat = getKafkaHeartbeat();

    const steps = [
      { name: "configure", label: "Configuring firmware" },
      { name: "install", label: "Installing services" },
      { name: "test", label: "Running diagnostics" },
      { name: "activate", label: "Activating on network" },
    ];

    for (const step of steps) {
      this.provisioningStore.updateStep(provisioningId, step.name);
      this.logger.log(`[${deviceSerial}] ${step.label}...`);

      // Simulate a long-running step (~8 s each).
      // Each step exceeds a typical heartbeat interval — we send a heartbeat
      // after each one to prevent a broker-side session timeout.
      await this.simulateStep();
      await heartbeat?.();

      this.logger.log(`[${deviceSerial}] ${step.label} done`);
    }

    this.provisioningStore.complete(provisioningId);
    this.logger.log(`[${deviceSerial}] Provisioning complete`);

    await emit({
      eventType: "device-provisioning.completed",
      stepName: "complete-device-provisioning",
      payload: {
        provisioningId,
        deviceSerial,
        completedAt: new Date().toISOString(),
      },
    });
  }

  private simulateStep(): Promise<void> {
    const stepDurationMs = parseInt(
      process.env.PROVISIONING_STEP_MS ?? "8000",
      10,
    );
    return new Promise((resolve) => setTimeout(resolve, stepDurationMs));
  }
}
