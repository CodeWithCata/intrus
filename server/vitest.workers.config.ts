/**
 * Tests that run INSIDE the Workers runtime (workerd) against the real Durable Object, with real storage and alarms.
 * Run: pnpm test:workers (not part of `pnpm test`). NOT RUNNABLE YET: @cloudflare/vitest-pool-workers 0.23 needs
 * vitest ^4.1 and this repo is on vitest 5, so the package is not installed. When a release supports vitest 5, run
 * `pnpm add -D @cloudflare/vitest-pool-workers` and adapt this file to its config API. The tests themselves only use
 * `SELF`, `env`, `runInDurableObject` and `runDurableObjectAlarm` from "cloudflare:test".
 */
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["server/tests/workers/**/*.test.ts"],
    poolOptions: {
      workers: {
        singleWorker: true,
        isolatedStorage: false,
        wrangler: { configPath: "./server/wrangler.toml" },
        miniflare: {
          bindings: { CODE_SECRET: "test-secret", ALLOWED_ORIGINS: "https://app.test" }
        }
      }
    }
  }
});
