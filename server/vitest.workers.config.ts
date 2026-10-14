/**
 * Tests that run INSIDE the Workers runtime (workerd) against the real Durable Object, with real storage and alarms.
 * Run: pnpm test:workers (not part of `pnpm test`). Uses @cloudflare/vitest-plugin (the renamed
 * @cloudflare/vitest-pool-workers), which supports Vitest 4.1+ and 5. Storage is no longer rolled back between tests,
 * so every test uses its own room code (see newCode() in the test file).
 */
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        cloudflareTest({
            wrangler: { configPath: "./server/wrangler.toml" },
            miniflare: {
                bindings: { CODE_SECRET: "test-secret", ALLOWED_ORIGINS: "https://app.test" }
            }
        })
    ],
    test: {
        include: ["server/tests/workers/**/*.test.ts"]
    }
});
