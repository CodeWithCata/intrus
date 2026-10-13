import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the REAL stack: the SvelteKit dev server and the game server (`wrangler dev`, so the
 * real Durable Object). The game server gets a test CODE_SECRET on the command line; the app is told where it is
 * through VITE_PARTY_HOST. NOT VERIFIED when written (Playwright and wrangler could not be installed).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    locale: "ro-RO",
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
  webServer: [
    {
      command: "pnpm party:dev --port 8787 --var CODE_SECRET:e2e-secret --var ALLOWED_ORIGINS:http://localhost:5173",
      port: 8787,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "pnpm dev --port 5173 --strictPort",
      port: 5173,
      env: { VITE_PARTY_HOST: "localhost:8787" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
