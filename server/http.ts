/** POST /api/new-code: the only HTTP endpoint. Pure function of its dependencies, so it is unit-tested without a Worker. */
import { isAllowedOrigin } from "./origin.ts";
import { randomCode } from "./room-logic.ts";
import { issueTicket } from "./tickets.ts";

export const CODE_LENGTH = 6;
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ConnectDeps {
  allowedOrigins: string | undefined;
  limiter?: Limiter;
}

/**
 * Decides whether a WebSocket upgrade may reach a room: only the "game" party, only well-formed upper-case codes (so no
 * junk Durable Objects), only allowed origins, and a per-IP rate limit (Origin is forgeable outside browsers).
 * Returns the refusal, or null to let the request through.
 */
export async function refuseConnect(request: Request, party: string, room: string, deps: ConnectDeps): Promise<Response | null> {
  if (party !== "game" || !CODE_RE.test(room)) return new Response("Not found", { status: 404 });
  if (!isAllowedOrigin(request.headers.get("Origin"), deps.allowedOrigins)) return new Response("Forbidden", { status: 403 });
  if (deps.limiter) {
    const { success } = await deps.limiter.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
    if (!success) return new Response("Too many connections", { status: 429, headers: { "Retry-After": "60" } });
  }
  return null;
}

export interface NewCodeDeps {
  allowedOrigins: string | undefined;
  secret: string | undefined;
  now: number;
  rng: () => number;
  limiter?: Limiter;
}

export async function handleNewCode(request: Request, deps: NewCodeDeps): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, deps.allowedOrigins)) return new Response("Forbidden", { status: 403 });
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  if (!deps.secret) return Response.json({ error: "not-configured" }, { status: 500, headers: cors });
  if (deps.limiter) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await deps.limiter.limit({ key: ip });
    if (!success) return Response.json({ error: "rate-limited" }, { status: 429, headers: { ...cors, "Retry-After": "60" } });
  }
  const code = randomCode(deps.rng, CODE_LENGTH);
  const { ticket, expires } = await issueTicket(deps.secret, code, deps.now);
  return Response.json({ code, ticket, expires }, { headers: { ...cors, "Cache-Control": "no-store" } });
}
