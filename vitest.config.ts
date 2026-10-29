import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // One in-memory MongoDB for the whole run (tests/setup/globalSetup.ts)
    globalSetup: ["tests/setup/globalSetup.ts"],
    // Test env vars must be set before the app's modules are imported
    setupFiles: ["tests/setup/env.ts"],
    // Every file shares the hard-coded SaLuDoTesting database
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
