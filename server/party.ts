/**
 * Cloudflare entry point: a PartyKit (`partyserver`) Durable Object plus the Worker's HTTP routes.
 * Only glue lives here; the rules are in room-logic.ts and the message handling in session.ts.
 *
 * NOT VERIFIED against the real packages (they could not be installed when this was written): check the
 * partyserver API names used below (static options.hibernate, onStart/onConnect/onMessage/onClose/onAlarm,
 * Connection.state/setState, getConnections, routePartykitRequest options) against the installed version.
 *
 * URLs: wss://HOST/parties/game/<CODE>   (the binding is named "Game", so the party is "game")
 *       POST https://HOST/api/new-code    -> { code, ticket, expires }
 */
import { Server, routePartykitRequest } from "partyserver";
import type { Connection, ConnectionContext, WSMessage } from "partyserver";
import { handleNewCode, refuseConnect, type Limiter } from "./http.ts";
import { loadPacks } from "./packs.ts";
import { secureRng } from "./random.ts";
import { RoomSession, type Conn } from "./session.ts";
import { verifyTicket } from "./tickets.ts";

interface Env {
  Game: DurableObjectNamespace;
  /** Comma-separated origins allowed to connect (see origin.ts). */
  ALLOWED_ORIGINS?: string;
  /** Secret for create tickets: `wrangler secret put CODE_SECRET` (and .dev.vars locally). */
  CODE_SECRET?: string;
  NEW_CODE_LIMITER?: Limiter;
  /** Per-IP limit on WebSocket upgrades (see wrangler.toml). Optional: without the binding there is no limit. */
  CONNECT_LIMITER?: Limiter;
}

interface ConnState {
  playerId: string | null;
  connectedAt: number;
}

/** A partyserver Connection viewed as a session Conn. The login lives in the socket's own state, so it survives hibernation. */
function adapt(c: Connection): Conn {
  const st = (): ConnState => (c.state as ConnState | null) ?? { playerId: null, connectedAt: 0 };
  return {
    id: c.id,
    get playerId() {
      return st().playerId;
    },
    set playerId(value: string | null) {
      c.setState({ ...st(), playerId: value });
    },
    get connectedAt() {
      return st().connectedAt;
    },
    send: (data) => c.send(data),
    close: (code, reason) => c.close(code, reason)
  };
}

export class Game extends Server<Env> {
  static options = { hibernate: true };
  #session!: RoomSession;

  async onStart(): Promise<void> {
    // "ping" -> "pong" is answered by the runtime itself, without waking a hibernating room.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    const rng = secureRng();
    const code = this.name; // onBeforeConnect only lets the exact upper-case form through, so one room has one name
    this.#session = new RoomSession({
      code,
      packs: await loadPacks(),
      now: () => Date.now(),
      rng,
      connections: () => [...this.getConnections()].map(adapt),
      storage: {
        get: <T>(key: string) => this.ctx.storage.get<T>(key),
        put: (key, value) => this.ctx.storage.put(key, value),
        deleteAll: () => this.ctx.storage.deleteAll()
      },
      setAlarm: async (at) => {
        if (at === null) await this.ctx.storage.deleteAlarm();
        else await this.ctx.storage.setAlarm(at);
      },
      verifyTicket: (c, ticket, expires) => verifyTicket(this.env.CODE_SECRET ?? "", c, ticket, expires, Date.now())
    });
    await this.#session.load();
  }

  onConnect(conn: Connection, _ctx: ConnectionContext): void {
    conn.setState({ playerId: null, connectedAt: Date.now() } satisfies ConnState);
    this.#session.onConnect(adapt(conn));
  }

  onMessage(conn: Connection, message: WSMessage): Promise<void> | void {
    if (typeof message !== "string") return conn.close(1003, "Text only");
    return this.#session.onMessage(adapt(conn), message);
  }

  onClose(conn: Connection): Promise<void> {
    return this.#session.onClose(adapt(conn));
  }

  onError(conn: Connection, error: unknown): void {
    console.error("socket error", conn.id, error);
  }

  onAlarm(): Promise<void> {
    return this.#session.onAlarm();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/new-code") {
      return handleNewCode(request, {
        allowedOrigins: env.ALLOWED_ORIGINS,
        secret: env.CODE_SECRET,
        now: Date.now(),
        rng: secureRng(),
        limiter: env.NEW_CODE_LIMITER
      });
    }

    const routed = await routePartykitRequest(request, env as unknown as Record<string, unknown>, {
      // Only real, well-formed room codes from allowed origins may open a socket (no junk Durable Objects).
      onBeforeConnect: async (req, lobby) =>
        (await refuseConnect(req, lobby.party, lobby.name, { allowedOrigins: env.ALLOWED_ORIGINS, limiter: env.CONNECT_LIMITER })) ?? req,
      // Rooms speak WebSocket only: no plain HTTP into a Durable Object.
      onBeforeRequest: () => new Response("Not found", { status: 404 })
    });
    return routed ?? new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
