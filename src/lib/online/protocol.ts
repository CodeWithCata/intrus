/**
 * Client-side view of the online protocol. TYPES AND CONSTANTS ONLY: the schemas (and valibot) stay on the server.
 * The definitions live in server/protocol.ts; `import type` is erased at build time, so nothing from there is bundled.
 */
export type { ClientMessage, ClientMessageType, ServerMessage } from "../../../server/protocol.ts";
export type { PublicState, Role, Settings, Phase, Hint, Outcome } from "../../../server/types.ts";

/** Plain-text heartbeat (kept in sync with server/protocol.ts). */
export const PING = "ping";
export const PONG = "pong";
