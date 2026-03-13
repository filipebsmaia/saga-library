import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/@core'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
