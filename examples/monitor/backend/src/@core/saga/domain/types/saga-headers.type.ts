import type { EventHint } from './event-hint.type';

export interface ParsedSagaHeaders {
  sagaId: string;
  sagaRootId: string;
  sagaParentId?: string;
  sagaCausationId: string;
  sagaEventId: string;
  sagaStepName: string;
  sagaStepDescription?: string;
  sagaEventHint?: EventHint;
  sagaName?: string;
  sagaDescription?: string;
  sagaPublishedAt: string;
  sagaSchemaVersion: number;
}
