import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@saga/core': path.resolve(__dirname, '../saga-core/src/index.ts'),
    },
  },
  test: {
    name: 'nestjs',
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
  },
});
