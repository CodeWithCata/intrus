import { readFileSync } from "node:fs";
import { describe, expect, it, test } from "vitest";
import { buildCsp, buildHeaders, cleanHost } from "../../scripts/headers.mjs";

describe("netlify headers", () => {
  it("cleanHost accepts a plain host and refuses anything that could widen the policy", () => {
    expect(cleanHost("https://party.example.dev/")).toBe("party.example.dev");
    expect(cleanHost(" localhost:8787 ")).toBe("localhost:8787");
    for (const bad of ["", undefined, "a b", "x;y", "*.example.dev", "party.example.dev/path", "https://a.dev https://evil.dev", "a.dev;script-src *", "-bad.dev"]) {
      expect(cleanHost(bad)).toBeNull();
    }
  });

  it("the policy allows the game server's wss and https address, and nothing else beyond 'self'", () => {
    const csp = buildCsp("party.example.dev");
    expect(csp).toContain("connect-src 'self' wss://party.example.dev https://party.example.dev");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp.includes("*")).toBe(false);
    expect(csp.includes("unsafe-eval")).toBe(false);
  });

  it("without a server the app may only talk to itself", () => {
    expect(buildCsp(undefined)).toContain("connect-src 'self';");
    expect(buildCsp("not a host!")).toContain("connect-src 'self';");
  });

  it("caches hashed files forever and never caches the shell, service worker or manifest", () => {
    const h = buildHeaders({ partyHost: "party.example.dev" });
    expect(h).toMatch(/\/_app\/immutable\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
    for (const path of ["/", "/index.html", "/service-worker.js", "/manifest.json", "/online/*"]) {
      expect(h).toContain(`\n${path}\n  Cache-Control: no-cache`);
    }
  });

  it("report-only mode uses the report-only header and not the enforcing one", () => {
    const h = buildHeaders({ partyHost: "p.dev", reportOnly: true });
    expect(h).toContain("Content-Security-Policy-Report-Only:");
    expect(h.replace("Content-Security-Policy-Report-Only", "")).not.toContain("Content-Security-Policy:");
    expect(buildHeaders({ partyHost: "p.dev" })).toContain("  Content-Security-Policy: ");
  });
});

describe("netlify.toml redirects", () => {
  const toml = readFileSync("netlify.toml", "utf8");
  const rules = [...toml.matchAll(/\[\[redirects\]\]\s+from = "([^"]+)"\s+to = "([^"]+)"\s+status = (\d+)/g)].map((m) => ({ from: m[1], status: Number(m[3]) }));

  test("a missing /_app/ file is a 404, listed before the catch-all (never the app shell under an immutable URL)", () => {
    const app = rules.findIndex((r) => r.from === "/_app/*");
    const all = rules.findIndex((r) => r.from === "/*");
    expect(app).toBeGreaterThanOrEqual(0);
    expect(rules[app].status).toBe(404);
    expect(app).toBeLessThan(all);
  });
});
