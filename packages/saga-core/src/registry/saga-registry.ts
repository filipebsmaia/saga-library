import type {
  SagaParticipant,
  HandlerConfig,
} from "../interfaces/saga-participant.interface";
import type { EventHandler } from "../interfaces/event-handler.type";
import { SagaDuplicateHandlerError } from "../errors/saga-duplicate-handler.error";
import { SagaInvalidHandlerConfigError } from "../errors/saga-invalid-handler-config.error";

export interface RouteEntry {
  participant: SagaParticipant;
  handler: EventHandler;
  options?: HandlerConfig;
}

export class SagaRegistry {
  private participants: SagaParticipant[] = [];

  register(participant: SagaParticipant): void {
    this.participants.push(participant);
  }

  getAll(): SagaParticipant[] {
    return [...this.participants];
  }

  buildRouteMap(): Map<string, RouteEntry> {
    const map = new Map<string, RouteEntry>();

    for (const participant of this.participants) {
      for (const [topic, handler] of Object.entries(participant.on)) {
        if (map.has(topic)) {
          const existing = map.get(topic)!;
          throw new SagaDuplicateHandlerError(
            topic,
            existing.participant.serviceId,
            participant.serviceId,
          );
        }
        const options = participant.handlerOptions?.[topic];
        if (options?.final && options?.fork) {
          throw new SagaInvalidHandlerConfigError(
            topic,
            participant.serviceId,
            "cannot have both final and fork options",
          );
        }
        map.set(topic, { participant, handler, options });
      }
    }

    return map;
  }
}
