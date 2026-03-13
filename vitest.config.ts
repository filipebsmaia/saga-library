import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/saga-core/vitest.config.ts',
      'packages/saga-transport-kafka/vitest.config.ts',
      'packages/saga-nestjs/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.interface.ts', '**/*.type.ts'],
    },
  },
});
