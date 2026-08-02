import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    isolate: false,
    // Test files share one Postgres instance and truncate all tables between
    // tests, so files must run one after another, never interleaved.
    fileParallelism: false,
    poolOptions: {
      threads: { singleThread: true },
    },
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
