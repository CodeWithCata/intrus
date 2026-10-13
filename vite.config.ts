import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

// Hosts a tunnel may use (a leading dot also matches subdomains). Local development only.
const TUNNEL_HOSTS = [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app", ".ngrok.dev", ".ngrok.io", ".ngrok.pizza"];

export default defineConfig(({ mode }) => {
  // `pnpm dev:tunnel` runs `vite dev --mode tunnel`. Behind an HTTPS tunnel the browser reaches Vite on port 443, not on
  // Vite's own port, so the hot-reload websocket must be told to use wss on 443. Without this the client keeps trying
  // wss://<tunnel-host>:5173, which never answers, and the page spins forever. `host: true` also makes Vite listen on
  // IPv4 and IPv6, so the tunnel agent can reach it whichever one "localhost" resolves to.
  const tunnel = mode === "tunnel";
  const serverOpts = {
    allowedHosts: TUNNEL_HOSTS,
    ...(tunnel ? { host: true, hmr: { protocol: "wss", clientPort: 443 } } : {})
  };
  return {
    plugins: [sveltekit({ adapter: adapter({ fallback: "index.html" }) })],
    // Tests mount real Svelte components in jsdom, so resolve Svelte's browser build (not the server one).
    resolve: process.env.VITEST ? { conditions: ["browser"] } : undefined,
    server: serverOpts,
    preview: { allowedHosts: TUNNEL_HOSTS, ...(tunnel ? { host: true } : {}) },
    test: { include: ["tests/unit/**/*.test.ts", "server/tests/*.test.ts"] }
  };
});
