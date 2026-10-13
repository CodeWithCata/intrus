import { describe, expect, test } from "vitest";
import { CODE_RE, handleNewCode, refuseConnect } from "../http.ts";
import { secureRng } from "../random.ts";
import { verifyTicket } from "../tickets.ts";

const NOW = 5_000_000;
const deps = (over = {}) => ({ allowedOrigins: "https://app.example.com", secret: "s3cret", now: NOW, rng: secureRng(), ...over });
const req = (method: string, origin: string | null = "https://app.example.com") =>
  new Request("https://party.example.com/api/new-code", { method, headers: origin ? { Origin: origin } : {} });

describe("POST /api/new-code", () => {
  test("returns a well-formed code and a ticket that verifies for exactly that code", async () => {
    const res = await handleNewCode(req("POST"), deps());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: string; ticket: string; expires: number };
    expect(CODE_RE.test(body.code)).toBe(true);
    expect(await verifyTicket("s3cret", body.code, body.ticket, body.expires, NOW)).toBe(true);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("codes are different every time", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(((await (await handleNewCode(req("POST"), deps())).json()) as { code: string }).code);
    expect(seen.size).toBeGreaterThan(15);
  });

  test("wrong or missing origin is forbidden", async () => {
    expect((await handleNewCode(req("POST", "https://evil.com"), deps())).status).toBe(403);
    expect((await handleNewCode(req("POST", null), deps())).status).toBe(403);
  });

  test("only POST (and the OPTIONS preflight) are allowed", async () => {
    expect((await handleNewCode(req("GET"), deps())).status).toBe(405);
    expect((await handleNewCode(req("OPTIONS"), deps())).status).toBe(204);
  });

  test("fails closed when no secret is configured", async () => {
    expect((await handleNewCode(req("POST"), deps({ secret: undefined }))).status).toBe(500);
  });

  test("the rate limiter is consulted per IP and can refuse", async () => {
    const keys: string[] = [];
    const limiter = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: keys.length <= 1 }) };
    const r = () => new Request("https://p/api/new-code", { method: "POST", headers: { Origin: "https://app.example.com", "CF-Connecting-IP": "1.2.3.4" } });
    expect((await handleNewCode(r(), deps({ limiter }))).status).toBe(200);
    const second = await handleNewCode(r(), deps({ limiter }));
    expect(second.status).toBe(429);
    expect(keys).toEqual(["1.2.3.4", "1.2.3.4"]);
  });
});

describe("room code format", () => {
  test("only the exact upper-case form is a room name (one room, one name)", () => {
    expect(CODE_RE.test("ABCDEF")).toBe(true);
    expect(CODE_RE.test("abcdef")).toBe(false);
    expect(CODE_RE.test("AbCdEf")).toBe(false);
    expect(CODE_RE.test("ABCDE0")).toBe(false); // no 0/O/1/I
  });
});

describe("refuseConnect", () => {
  const req = (origin = "https://intrus.example", ip = "1.2.3.4") =>
    new Request("https://x/parties/game/ABCDEF", { headers: { Origin: origin, "CF-Connecting-IP": ip } });
  const deps = { allowedOrigins: "https://intrus.example" };

  test("lets a good request through", async () => {
    expect(await refuseConnect(req(), "game", "ABCDEF", deps)).toBeNull();
  });

  test("refuses other parties, lower-case codes and bad codes with 404", async () => {
    for (const [party, room] of [["other", "ABCDEF"], ["game", "abcdef"], ["game", "ABC"], ["game", "ABCDE0"]]) {
      expect((await refuseConnect(req(), party, room, deps))?.status).toBe(404);
    }
  });

  test("refuses an origin that is not allowed with 403", async () => {
    expect((await refuseConnect(req("https://evil.example"), "game", "ABCDEF", deps))?.status).toBe(403);
  });

  test("rate-limits per IP with 429 and a Retry-After header", async () => {
    const seen: string[] = [];
    const limiter = { limit: async ({ key }: { key: string }) => (seen.push(key), { success: key !== "9.9.9.9" }) };
    expect(await refuseConnect(req(undefined, "1.2.3.4"), "game", "ABCDEF", { ...deps, limiter })).toBeNull();
    const refused = await refuseConnect(req(undefined, "9.9.9.9"), "game", "ABCDEF", { ...deps, limiter });
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("Retry-After")).toBe("60");
    expect(seen).toEqual(["1.2.3.4", "9.9.9.9"]);
  });
});
