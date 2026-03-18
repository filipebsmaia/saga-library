import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { SagaModule } from "../src/saga.module";
import { SagaPublisherProvider } from "../src/providers/saga-publisher.provider";
import { SAGA_OPTIONS_TOKEN } from "../src/constants";
import { SagaRunner } from "@fbsm/saga-core";
import type { SagaTransport } from "@fbsm/saga-core";

function createMockTransport(): SagaTransport {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SagaModule", () => {
  describe("forRoot", () => {
    it("should return a DynamicModule with correct structure", () => {
      const transport = createMockTransport();
      const result = SagaModule.forRoot({
        groupId: "test-group",
        transport,
      });

      expect(result.module).toBe(SagaModule);
      expect(result.global).toBe(true);
      expect(result.providers).toBeDefined();
      expect(result.exports).toBeDefined();
    });

    it("should export SagaPublisherProvider", () => {
      const transport = createMockTransport();
      const result = SagaModule.forRoot({
        groupId: "test-group",
        transport,
      });

      expect(result.exports).toContain(SagaPublisherProvider);
    });

    it("should export SAGA_OPTIONS_TOKEN", () => {
      const transport = createMockTransport();
      const result = SagaModule.forRoot({
        groupId: "test-group",
        transport,
      });

      expect(result.exports).toContain(SAGA_OPTIONS_TOKEN);
    });
  });

  describe("forRootAsync", () => {
    it("should return a DynamicModule with correct structure", () => {
      const transport = createMockTransport();
      const result = SagaModule.forRootAsync({
        useFactory: () => ({
          groupId: "test-group",
          transport,
        }),
      });

      expect(result.module).toBe(SagaModule);
      expect(result.global).toBe(true);
      expect(result.providers).toBeDefined();
      expect(result.exports).toBeDefined();
    });

    it("should support imports option", () => {
      const transport = createMockTransport();
      const MockModule = class {};

      const result = SagaModule.forRootAsync({
        imports: [MockModule as any],
        useFactory: () => ({
          groupId: "test-group",
          transport,
        }),
      });

      expect(result.imports).toContainEqual(MockModule);
    });

    it("should support inject option", () => {
      const transport = createMockTransport();
      const CONFIG_TOKEN = "CONFIG_TOKEN";

      const result = SagaModule.forRootAsync({
        useFactory: (_config: any) => ({
          groupId: "test-group",
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

  describe("runnerFactory", () => {
    it("forRoot should use default SagaRunner when no runnerFactory is provided", () => {
      const transport = createMockTransport();
      const result = SagaModule.forRoot({
        groupId: "test-group",
        transport,
      });

      const runnerProvider = (result.providers as any[]).find(
        (p: any) => p.provide === SagaRunner,
      );

      expect(runnerProvider).toBeDefined();
      expect(runnerProvider.useValue).toBeInstanceOf(SagaRunner);
    });

    it("forRoot should use runnerFactory when provided", () => {
      const transport = createMockTransport();
      const customRunner = { custom: true } as any;
      const runnerFactory = vi.fn().mockReturnValue(customRunner);

      const result = SagaModule.forRoot({
        groupId: "test-group",
        transport,
        runnerFactory,
      });

      const runnerProvider = (result.providers as any[]).find(
        (p: any) => p.provide === SagaRunner,
      );

      expect(runnerFactory).toHaveBeenCalledOnce();
      expect(runnerProvider.useValue).toBe(customRunner);
    });

    it("forRoot runnerFactory should receive correct arguments", () => {
      const transport = createMockTransport();
      const runnerFactory = vi.fn().mockReturnValue({} as any);

      SagaModule.forRoot({
        groupId: "test-group",
        transport,
        runnerFactory,
      });

      const [registry, factoryTransport, publisher, parser, options, otelCtx] =
        runnerFactory.mock.calls[0];

      expect(registry).toBeDefined();
      expect(factoryTransport).toBe(transport);
      expect(publisher).toBeDefined();
      expect(parser).toBeDefined();
      expect(options.groupId).toBe("test-group");
      expect(otelCtx).toBeDefined();
    });

    it("forRootAsync should use runnerFactory in the SagaRunner provider factory", () => {
      const transport = createMockTransport();
      const customRunner = { custom: true } as any;
      const runnerFactory = vi.fn().mockReturnValue(customRunner);

      const result = SagaModule.forRootAsync({
        useFactory: () => ({
          groupId: "test-group",
          transport,
          runnerFactory,
        }),
      });

      const runnerProvider = (result.providers as any[]).find(
        (p: any) => p.provide === SagaRunner,
      );

      expect(runnerProvider).toBeDefined();
      expect(runnerProvider.useFactory).toBeTypeOf("function");
    });
  });
});
