import { MESSAGE_HANDLER_METADATA } from "../constants";

export function MessageHandler(
  ...topics: string[]
): MethodDecorator {
  return (target, propertyKey) => {
    const existing: Map<string, string | symbol> =
      Reflect.getMetadata(MESSAGE_HANDLER_METADATA, target.constructor) ??
      new Map();
    for (const topic of topics) {
      existing.set(topic, propertyKey);
    }
    Reflect.defineMetadata(
      MESSAGE_HANDLER_METADATA,
      existing,
      target.constructor,
    );
  };
}
