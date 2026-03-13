import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { SagaModule } from '../src/saga.module';
import { SagaPublisherProvider } from '../src/providers/saga-publisher.provider';
import { SAGA_OPTIONS_TOKEN } from '../src/constants';
import type { SagaTransport } from '@saga/core';

function createMockTransport(): SagaTransport {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SagaModule', () => {
  describe('forRoot', () => {
    it('should return a DynamicModule with correct structure', () => {
      const transport = createMockTransport();
      const result = SagaModule.forRoot({
        serviceName: 'test-service',
        transport,
      });

      expect(result.module).toBe(SagaModule);
      expect(result.global).toBe(true);
      expect(result.providers).toBeDefined();
      expect(result.exports).toBeDefined();
    });

    it('should export SagaPublisherProvider', () => {
      const transport = createMockTransport();
      const result = SagaModule.forRoot({
        serviceName: 'test-service',
        transport,
      });

      expect(result.exports).toContain(SagaPublisherProvider);
    });

    it('should export SAGA_OPTIONS_TOKEN', () => {
      const transport = createMockTransport();
      const result = SagaModule.forRoot({
        serviceName: 'test-service',
        transport,
      });

      expect(result.exports).toContain(SAGA_OPTIONS_TOKEN);
    });
  });

  describe('forRootAsync', () => {
    it('should return a DynamicModule with correct structure', () => {
      const transport = createMockTransport();
      const result = SagaModule.forRootAsync({
        useFactory: () => ({
          serviceName: 'test-service',
          transport,
        }),
      });

      expect(result.module).toBe(SagaModule);
      expect(result.global).toBe(true);
      expect(result.providers).toBeDefined();
      expect(result.exports).toBeDefined();
    });

    it('should support imports option', () => {
      const transport = createMockTransport();
      const MockModule = class {};

      const result = SagaModule.forRootAsync({
        imports: [MockModule as any],
        useFactory: () => ({
          serviceName: 'test-service',
          transport,
        }),
      });

      expect(result.imports).toContainEqual(MockModule);
    });

    it('should support inject option', () => {
      const transport = createMockTransport();
      const CONFIG_TOKEN = 'CONFIG_TOKEN';

      const result = SagaModule.forRootAsync({
        useFactory: (_config: any) => ({
          serviceName: 'test-service',
          transport,
        }),
        inject: [CONFIG_TOKEN],
      });

      const optionsProvider = (result.providers as any[]).find(
        (p: any) => p.provide === SAGA_OPTIONS_TOKEN,
      );

      expect(optionsProvider).toBeDefined();
      expect(optionsProvider.inject).toContain(CONFIG_TOKEN);
    });
  });
});
