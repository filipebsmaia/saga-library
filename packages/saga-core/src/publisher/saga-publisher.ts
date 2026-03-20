import { v7 as uuidv7 } from "uuid";
import type { SagaEvent } from "../interfaces/saga-event.interface";
import type { Emit, EmitParams } from "../interfaces/emit.type";
import type { ParentSagaContext } from "../interfaces/parent-saga-context.interface";
import type { SagaTransport } from "../transport/transport.interface";
import type { OtelContext } from "../otel/otel-context";
import { SagaContext } from "../context/saga-context";
import { SagaNoParentError } from "../errors/saga-no-parent.error";
import { buildOutboundMessage } from "./message-builder";

export interface SagaStartOptions {
  sagaName?: string;
  sagaDescription?: string;
  key?: string;
  independent?: boolean;
}

export class SagaPublisher {
  constructor(
    private transport: SagaTransport,
    private otelCtx: OtelContext,
    private topicPrefix = "",
  ) {}

  async start<R>(
    fn: () => R | Promise<R>,
    opts?: SagaStartOptions,
  ): Promise<{ sagaId: string; result: Awaited<R> }> {
    const existingContext = SagaContext.current();
    if (existingContext && !opts?.independent) {
      return this.startChild(fn, opts);
    }

    const sagaId = uuidv7();
    const ctxData = {
      sagaId,
      rootSagaId: sagaId,
      ancestorChain: [] as string[],
      causationId: sagaId,
      key: opts?.key,
      sagaName: opts?.sagaName,
      sagaDescription: opts?.sagaDescription,
    };
    const result = await SagaContext.run(ctxData, fn);
    return { sagaId, result: result as Awaited<R> };
  }

  async emit<T extends object>(params: EmitParams<T>): Promise<void> {
    const ctx = SagaContext.require();
    const boundEmit = this.forSaga(
      ctx.sagaId,
      {
        parentSagaId: ctx.parentSagaId,
        rootSagaId: ctx.rootSagaId,
        ancestorChain: ctx.ancestorChain,
      },
      ctx.causationId,
      ctx.key,
    );
    return boundEmit(params);
  }

  async startChild<R>(
    fn: () => R | Promise<R>,
    opts?: SagaStartOptions,
  ): Promise<{ sagaId: string; result: Awaited<R> }> {
    const ctx = SagaContext.require();
    const sagaId = uuidv7();
    const childCtx = {
      sagaId,
      rootSagaId: ctx.rootSagaId,
      parentSagaId: ctx.sagaId,
      ancestorChain: [ctx.sagaId, ...(ctx.ancestorChain ?? [])],
      causationId: ctx.causationId,
      key: opts?.key ?? ctx.key,
      sagaName: opts?.sagaName ?? ctx.sagaName,
      sagaDescription: opts?.sagaDescription ?? ctx.sagaDescription,
    };
    const result = await SagaContext.run(childCtx, fn);
    return { sagaId, result: result as Awaited<R> };
  }

  async emitToParent<T extends object>(
    paramsOrFn: EmitParams<T> | (() => void | Promise<void>),
  ): Promise<void> {
    const ctx = SagaContext.require();
    if (!ctx.parentSagaId) {
      throw new SagaNoParentError();
    }

    const parentAncestorChain = (ctx.ancestorChain ?? []).slice(1);
    const grandparent = parentAncestorChain[0];

    if (typeof paramsOrFn === "function") {
      const parentCtx = {
        sagaId: ctx.parentSagaId,
        rootSagaId: ctx.rootSagaId,
        parentSagaId: grandparent,
        ancestorChain: parentAncestorChain,
        causationId: ctx.causationId,
        key: ctx.key,
      };
      await SagaContext.run(parentCtx, paramsOrFn);
      return;
    }

    const parentEmit = this.forSaga(
      ctx.parentSagaId,
      {
        parentSagaId: grandparent,
        rootSagaId: ctx.rootSagaId,
        ancestorChain: parentAncestorChain,
      },
      ctx.causationId,
      ctx.key,
    );
    return parentEmit(paramsOrFn);
  }

  forSaga(
    sagaId: string,
    parentCtx?: ParentSagaContext,
    causationId?: string,
    baseKey?: string,
  ): Emit {
    const rootSagaId = parentCtx?.rootSagaId ?? sagaId;
    const parentSagaId = parentCtx?.parentSagaId;
    const ancestorChain = parentCtx?.ancestorChain;
    const baseCausationId = causationId ?? sagaId;
    return async <T extends object>({
      topic,
      stepName,
      stepDescription,
      payload,
      hint,
      key,
    }: EmitParams<T>): Promise<void> => {
      const ctx = SagaContext.current();
      const resolvedKey = key ?? baseKey ?? ctx?.key;
      const now = new Date().toISOString();
      const event: SagaEvent<T> = {
        sagaId,
        causationId: baseCausationId,
        eventId: uuidv7(),
        topic,
        stepName,
        stepDescription,
        occurredAt: now,
        publishedAt: now,
        schemaVersion: 1,
        rootSagaId,
        parentSagaId,
        ancestorChain,
        payload,
        hint,
        key: resolvedKey,
        sagaName: ctx?.sagaName,
        sagaDescription: ctx?.sagaDescription,
      };

      await this.publish(event);
    };
  }

  async publish<T>(event: SagaEvent<T>): Promise<void> {
    this.otelCtx.injectBaggage(
      event.sagaId,
      event.rootSagaId,
      event.parentSagaId,
    );

    const attrs: Record<string, string> = {
      "saga.id": event.sagaId,
      "saga.topic": event.topic,
      "saga.step.name": event.stepName,
      "saga.root.id": event.rootSagaId,
    };
    if (event.sagaName) {
      attrs["saga.name"] = event.sagaName;
    }
    if (event.sagaDescription) {
      attrs["saga.description"] = event.sagaDescription;
    }
    if (event.stepDescription) {
      attrs["saga.step.description"] = event.stepDescription;
    }
    if (event.parentSagaId) {
      attrs["saga.parent.id"] = event.parentSagaId;
    }

    this.otelCtx.enrichSpan(attrs);

    const message = buildOutboundMessage(event, this.topicPrefix);

    this.otelCtx.injectTraceContext(message.headers);

    await this.otelCtx.withSpan(`saga.publish ${event.topic}`, attrs, () =>
      this.transport.publish(message),
    );
  }
}
