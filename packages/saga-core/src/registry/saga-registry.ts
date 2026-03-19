import type {
  SagaParticipant,
  HandlerConfig,
} from "../interfaces/saga-participant.interface";
import type { EventHandler } from "../interfaces/event-handler.type";
import type { PlainHandler } from "../interfaces/plain-message.interface";
import { SagaDuplicateHandlerError } from "../errors/saga-duplicate-handler.error";
import { SagaInvalidHandlerConfigError } from "../errors/saga-invalid-handler-config.error";

export interface RouteEntry {
  sagaParticipant?: SagaParticipant;
  sagaHandler?: EventHandler;
  sagaOptions?: HandlerConfig;

  plainParticipant?: SagaParticipant;
  plainHandler?: PlainHandler;
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
      // Register saga handlers
      for (const [topic, handler] of Object.entries(participant.on)) {
        const existing = map.get(topic) ?? {};

        if (existing.sagaHandler) {
          throw new SagaDuplicateHandlerError(
            topic,
            existing.sagaParticipant!.serviceId,
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

        map.set(topic, {
          ...existing,
          sagaParticipant: participant,
          sagaHandler: handler,
          sagaOptions: options,
        });
      }

      // Register plain handlers
      if (participant.onPlain) {
        for (const [topic, handler] of Object.entries(participant.onPlain)) {
          const existing = map.get(topic) ?? {};

          if (existing.plainHandler) {
            throw new SagaDuplicateHandlerError(
              topic,
              existing.plainParticipant!.serviceId,
              participant.serviceId,
            );
          }

          map.set(topic, {
            ...existing,
            plainParticipant: participant,
            plainHandler: handler,
          });
        }
      }
    }

    return map;
  }
}
