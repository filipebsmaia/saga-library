import { SagaStatus } from "./saga";

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
}

export interface ListSagasParams {
  status?: SagaStatus;
  sagaName?: string;
  sagaRootId?: string;
  startDate?: string;
  endDate?: string;
  rootsOnly?: boolean;
  activeOnly?: boolean;
  compensating?: boolean;
  stuck?: boolean;
  cursor?: string;
  limit?: number;
}

export interface ListSagaEventsParams {
  cursor?: string;
  limit?: number;
}
