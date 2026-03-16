import type { IncomingEvent } from "./incoming-event.interface";
import type { Emit } from "./emit.type";

export type EventHandler<T = Record<string, unknown>> = (
  event: IncomingEvent<T>,
  emit: Emit,
) => Promise<void>;
