import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  splitting: false,
  external: [
    '@saga/core',
    '@nestjs/common',
    '@nestjs/core',
    'reflect-metadata',
  ],
});
