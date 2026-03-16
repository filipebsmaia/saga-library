import {
  SAGA_HANDLER_METADATA,
  SAGA_HANDLER_OPTIONS_METADATA,
} from "../constants";

import type { ForkConfig } from "@fbsm/saga-core";

export interface SagaHandlerOptions {
  final?: boolean;
  fork?: boolean | ForkConfig;
}

export function SagaHandler(
  ...args: [...string[]] | [...string[], SagaHandlerOptions]
): MethodDecorator {
  let eventTypes: string[];
  let options: SagaHandlerOptions = {};

  const lastArg = args[args.length - 1];
  if (typeof lastArg === "object" && lastArg !== null) {
    options = lastArg as SagaHandlerOptions;
    eventTypes = args.slice(0, -1) as string[];
  } else {
    eventTypes = args as string[];
  }

  return (target, propertyKey) => {
    const existingMap: Map<string, string | symbol> =
      Reflect.getMetadata(SAGA_HANDLER_METADATA, target.constructor) ??
      new Map();
    const existingOptions: Map<string, SagaHandlerOptions> =
      Reflect.getMetadata(SAGA_HANDLER_OPTIONS_METADATA, target.constructor) ??
      new Map();

    for (const eventType of eventTypes) {
      existingMap.set(eventType, propertyKey);
      if (options.final || options.fork) {
        existingOptions.set(eventType, options);
      }
    }

    Reflect.defineMetadata(
      SAGA_HANDLER_METADATA,
      existingMap,
      target.constructor,
    );
    Reflect.defineMetadata(
      SAGA_HANDLER_OPTIONS_METADATA,
      existingOptions,
      target.constructor,
    );
  };
}
