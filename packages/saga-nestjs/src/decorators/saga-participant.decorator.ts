import type { ForkConfig } from "@fbsm/saga-core";
import {
  SAGA_PARTICIPANT_METADATA,
  SAGA_PARTICIPANT_TOPICS_METADATA,
  SAGA_PARTICIPANT_OPTIONS_METADATA,
} from "../constants";

export interface SagaParticipantOptions {
  final?: boolean;
  fork?: boolean | ForkConfig;
}

export function SagaParticipant(
  topics: string | string[],
  options?: SagaParticipantOptions,
): ClassDecorator {
  const topicArray = Array.isArray(topics) ? topics : [topics];
  return (target) => {
    Reflect.defineMetadata(SAGA_PARTICIPANT_METADATA, true, target);
    Reflect.defineMetadata(
      SAGA_PARTICIPANT_TOPICS_METADATA,
      topicArray,
      target,
    );
    if (options) {
      Reflect.defineMetadata(
        SAGA_PARTICIPANT_OPTIONS_METADATA,
        options,
        target,
      );
    }
  };
}
