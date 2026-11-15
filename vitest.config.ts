import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup/quiet-happy-dom-iframe.ts'],
    typecheck: {
      enabled: true,
      include: ['tests/unit/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
  },
});
