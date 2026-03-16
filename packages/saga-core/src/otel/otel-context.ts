export interface OtelContext {
  injectBaggage(
    sagaId: string,
    rootSagaId: string,
    parentSagaId?: string,
  ): void;
  extractBaggage(): {
    sagaId?: string;
    rootSagaId?: string;
    parentSagaId?: string;
  };
  enrichSpan(attrs: Record<string, string>): void;
  withSpan<T>(
    name: string,
    attrs: Record<string, string>,
    fn: () => Promise<T>,
  ): Promise<T>;
  injectTraceContext(headers: Record<string, string>): void;
  withExtractedSpan<T>(
    name: string,
    attrs: Record<string, string>,
    headers: Record<string, string>,
    fn: () => Promise<T>,
  ): Promise<T>;
}

export class NoopOtelContext implements OtelContext {
  injectBaggage(): void {}
  extractBaggage(): {
    sagaId?: string;
    rootSagaId?: string;
    parentSagaId?: string;
  } {
    return {};
  }
  enrichSpan(): void {}
  async withSpan<T>(
    _name: string,
    _attrs: Record<string, string>,
    fn: () => Promise<T>,
  ): Promise<T> {
    return fn();
  }
  injectTraceContext(): void {}
  async withExtractedSpan<T>(
    _name: string,
    _attrs: Record<string, string>,
    _headers: Record<string, string>,
    fn: () => Promise<T>,
  ): Promise<T> {
    return fn();
  }
}

type OtelAPI = typeof import("@opentelemetry/api");

export class W3cOtelContext implements OtelContext {
  private api: OtelAPI;

  constructor(api: OtelAPI) {
    this.api = api;
  }

  injectBaggage(
    sagaId: string,
    rootSagaId: string,
    parentSagaId?: string,
  ): void {
    const entries: Record<string, { value: string }> = {
      "saga.id": { value: sagaId },
      "saga.root.id": { value: rootSagaId },
    };
    if (parentSagaId) {
      entries["saga.parent.id"] = { value: parentSagaId };
    }

    const baggage = this.api.propagation.createBaggage(entries);
    const ctx = this.api.propagation.setBaggage(
      this.api.context.active(),
      baggage,
    );
    this.api.context.with(ctx, () => {});
  }

  extractBaggage(): {
    sagaId?: string;
    rootSagaId?: string;
    parentSagaId?: string;
  } {
    const baggage = this.api.propagation.getBaggage(this.api.context.active());
    if (!baggage) return {};

    return {
      sagaId: baggage.getEntry("saga.id")?.value,
      rootSagaId: baggage.getEntry("saga.root.id")?.value,
      parentSagaId: baggage.getEntry("saga.parent.id")?.value,
    };
  }

  enrichSpan(attrs: Record<string, string>): void {
    const span = this.api.trace.getActiveSpan();
    if (span) {
      span.setAttributes(attrs);
    }
  }

  async withSpan<T>(
    name: string,
    attrs: Record<string, string>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const tracer = this.api.trace.getTracer("@fbsm/saga-core");
    return tracer.startActiveSpan(name, async (span) => {
      span.setAttributes(attrs);
      try {
        const result = await fn();
        span.setStatus({ code: this.api.SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: this.api.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );
        throw error;
      } finally {
        span.end();
      }
    });
  }

  injectTraceContext(headers: Record<string, string>): void {
    this.api.propagation.inject(this.api.context.active(), headers);
  }

  async withExtractedSpan<T>(
    name: string,
    attrs: Record<string, string>,
    headers: Record<string, string>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const parentCtx = this.api.propagation.extract(
      this.api.ROOT_CONTEXT,
      headers,
    );
    const tracer = this.api.trace.getTracer("@fbsm/saga-core");

    return this.api.context.with(parentCtx, () =>
      tracer.startActiveSpan(
        name,
        { kind: this.api.SpanKind.CONSUMER },
        async (span) => {
          span.setAttributes(attrs);
          try {
            const result = await fn();
            span.setStatus({ code: this.api.SpanStatusCode.OK });
            return result;
          } catch (error) {
            span.setStatus({
              code: this.api.SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : String(error),
            });
            span.recordException(
              error instanceof Error ? error : new Error(String(error)),
            );
            throw error;
          } finally {
            span.end();
          }
        },
      ),
    );
  }
}

export function createOtelContext(enabled: boolean): OtelContext {
  if (!enabled) return new NoopOtelContext();

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("@opentelemetry/api");
    return new W3cOtelContext(api);
  } catch {
    return new NoopOtelContext();
  }
}
