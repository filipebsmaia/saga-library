import { Inject, Injectable } from '@nestjs/common';
import type { Emit, EmitParams, ParentSagaContext, SagaStartOptions } from '@saga/core';
import { SagaPublisher } from '@saga/core';

@Injectable()
export class SagaPublisherProvider {
  constructor(@Inject(SagaPublisher) private readonly publisher: SagaPublisher) {}

  start<R>(fn: () => R | Promise<R>, opts?: SagaStartOptions): Promise<{ sagaId: string; result: Awaited<R> }> {
    return this.publisher.start(fn, opts);
  }

  startChild<R>(fn: () => R | Promise<R>, opts?: SagaStartOptions): Promise<{ sagaId: string; result: Awaited<R> }> {
    return this.publisher.startChild(fn, opts);
  }

  emit<T extends object>(params: EmitParams<T>): Promise<void> {
    return this.publisher.emit(params);
  }

  emitToParent<T extends object>(paramsOrFn: EmitParams<T> | (() => void | Promise<void>)): Promise<void> {
    return this.publisher.emitToParent(paramsOrFn);
  }

  forSaga(sagaId: string, parentCtx?: ParentSagaContext, causationId?: string): Emit {
    return this.publisher.forSaga(sagaId, parentCtx, causationId);
  }
}
