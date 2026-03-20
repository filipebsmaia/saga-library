import { AsyncLocalStorage } from "node:async_hooks";
import { SagaContextNotFoundError } from "../errors/saga-context-not-found.error";

export interface SagaContextData {
  sagaId: string;
  rootSagaId: string;
  parentSagaId?: string;
  ancestorChain?: string[];
  causationId: string;
  key?: string;
  sagaName?: string;
  sagaDescription?: string;
}

export class SagaContext {
  private static storage = new AsyncLocalStorage<SagaContextData>();

  static run<T>(data: SagaContextData, fn: () => T): T {
    return SagaContext.storage.run(data, fn);
  }

  static current(): SagaContextData | undefined {
    return SagaContext.storage.getStore();
  }

  static require(): SagaContextData {
    const ctx = SagaContext.current();
    if (!ctx) {
      throw new SagaContextNotFoundError();
    }
    return ctx;
  }
}
