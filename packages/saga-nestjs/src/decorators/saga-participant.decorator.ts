import { SAGA_PARTICIPANT_METADATA } from '../constants';

export function SagaParticipant(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(SAGA_PARTICIPANT_METADATA, true, target);
  };
}
