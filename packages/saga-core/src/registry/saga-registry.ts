import type { SagaParticipant, HandlerConfig } from '../interfaces/saga-participant.interface';
import type { EventHandler } from '../interfaces/event-handler.type';
import { SagaDuplicateHandlerError } from '../errors/saga-duplicate-handler.error';
import { SagaInvalidHandlerConfigError } from '../errors/saga-invalid-handler-config.error';

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
      for (const [eventType, handler] of Object.entries(participant.on)) {
        if (map.has(eventType)) {
          const existing = map.get(eventType)!;
          throw new SagaDuplicateHandlerError(
            eventType,
            existing.participant.serviceId,
            participant.serviceId,
          );
        }
        const options = participant.handlerOptions?.[eventType];
        if (options?.final && options?.fork) {
          throw new SagaInvalidHandlerConfigError(
            eventType,
            participant.serviceId,
            'cannot have both final and fork options',
          );
        }
        map.set(eventType, { participant, handler, options });
      }
    }

    return map;
  }
}
