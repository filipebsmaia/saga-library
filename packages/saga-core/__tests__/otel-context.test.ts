import { describe, it, expect } from 'vitest';
import { NoopOtelContext, createOtelContext } from '../src/otel/otel-context';

describe('NoopOtelContext', () => {
  it('should not throw on injectBaggage', () => {
    const ctx = new NoopOtelContext();
    expect(() => ctx.injectBaggage('saga-123', 'root-123', 'parent-456')).not.toThrow();
  });

  it('should return empty object from extractBaggage', () => {
    const ctx = new NoopOtelContext();
    expect(ctx.extractBaggage()).toEqual({});
  });

  it('should not throw on enrichSpan', () => {
    const ctx = new NoopOtelContext();
    expect(() => ctx.enrichSpan({ 'saga.id': 'saga-123' })).not.toThrow();
  });

  it('should execute fn and return result in withSpan', async () => {
    const ctx = new NoopOtelContext();
    const result = await ctx.withSpan('test-span', { key: 'value' }, async () => 42);
    expect(result).toBe(42);
  });

  it('should not throw on injectTraceContext', () => {
    const ctx = new NoopOtelContext();
    const headers: Record<string, string> = {};
    expect(() => ctx.injectTraceContext(headers)).not.toThrow();
  });

  it('should execute fn and return result in withExtractedSpan', async () => {
    const ctx = new NoopOtelContext();
    const result = await ctx.withExtractedSpan('test-span', { key: 'value' }, {}, async () => 99);
    expect(result).toBe(99);
  });
});

describe('createOtelContext', () => {
  it('should return NoopOtelContext when disabled', () => {
    const ctx = createOtelContext(false);
    expect(ctx).toBeInstanceOf(NoopOtelContext);
  });

  it('should return NoopOtelContext when enabled but @opentelemetry/api is not available', () => {
    const ctx = createOtelContext(true);
    // In test environment, @opentelemetry/api is not installed
    // so it should fall back to NoopOtelContext
    expect(ctx.extractBaggage()).toEqual({});
  });
});
