import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Windows Defender and concurrent filesystem integration tests can push
    // valid snapshot/pairing operations beyond Vitest's 5-second default.
    testTimeout: 10_000,
  },
});
