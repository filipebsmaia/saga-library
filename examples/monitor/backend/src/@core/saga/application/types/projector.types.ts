import type { ParsedSagaHeaders } from '@core/saga/domain/types/saga-headers.type';
import type { SagaStateRecord } from '@core/saga/domain/repositories/saga-state.repository';

export interface PreparedMessage {
  parsed: ParsedSagaHeaders;
  headersJson: Record<string, string>;
  topic: string;
  partition: number;
  offset: string;
}

export interface SagaUpdate {
  state: Pick<
    SagaStateRecord,
    | 'sagaId'
    | 'sagaRootId'
    | 'sagaParentId'
    | 'sagaName'
    | 'sagaDescription'
    | 'status'
    | 'currentStepName'
    | 'currentStepDescription'
    | 'lastEventHint'
    | 'lastTopic'
    | 'startedAt'
    | 'endedAt'
    | 'updatedAt'
    | 'eventCount'
  >;
  event: {
    sagaEventId: string;
    sagaEventHint: string | null;
    sagaStepName: string;
    sagaPublishedAt: Date;
  };
}
