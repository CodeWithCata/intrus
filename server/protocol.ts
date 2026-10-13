/**
 * The online protocol: ONE definition of every message, used by the server (validation) and the client (types).
 * Client -> server messages are valibot schemas; the TypeScript types are inferred from them, so a type can never
 * drift from its check. Server -> client messages are plain types (the client trusts its own server).
 * The client imports only TYPES from here (see src/lib/online/protocol.ts), so valibot stays out of its bundle.
 *
 * Heartbeat is the plain text "ping" -> "pong" (not JSON), so Cloudflare can answer it without waking the room.
 */
import * as v from "valibot";
import { exceedsLimit } from "./limits.ts";
import { LOOK_MAX, isLookCode } from "../src/lib/components/players/avatar-parts.ts";
import type { PublicState, Role } from "./types.ts";

export const PING = "ping";
export const PONG = "pong";

const text = (max: number) => v.pipe(v.string(), v.maxLength(max));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(64));
/** A random value the client picks once per create / join attempt, so a repeated login (after a reconnect) finds its own seat instead of making a second one. */
const nonce = v.pipe(v.string(), v.minLength(16), v.maxLength(64));
const token = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const small = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(12));
/** An avatar builder look code. Only the drawn avatar travels: a photo (data URL) is too big and private. */
const look = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(LOOK_MAX), v.check((n) => isLookCode(n)));
/** "word|category|hint": 30 + 24 + 40 characters and the two separators, rounded up. */
export const CUSTOM_ENTRY_MAX = 100;
const hint = v.picklist(["category", "letter", "related", "none"]);

/** Settings the host may send. Every field optional; room-logic whitelists and clamps them again. */
export const SettingsSchema = v.object({
  cats: v.optional(v.pipe(v.array(text(64)), v.maxLength(64))),
  imposters: v.optional(small),
  minutes: v.optional(v.picklist([0, 1, 2, 3, 5])),
  hint: v.optional(hint),
  lang: v.optional(v.picklist(["ro", "en"])),
  customName: v.optional(text(24)),
  /** The host's own words, each "word", "word|category" or "word|category|hint". */
  customWords: v.optional(v.pipe(v.array(text(CUSTOM_ENTRY_MAX)), v.maxLength(100))),
  /** Game modes. The server decides what they do; a client can only switch them on or off. */
  tw: v.optional(v.boolean()),
  qm: v.optional(v.boolean()),
  troll: v.optional(v.boolean()),
  twn: v.optional(v.boolean()),
  kn: v.optional(v.boolean()),
  /** The opening wheel that picks who talks first. Host-only like every setting (see updateSettings). */
  wh: v.optional(v.boolean())
});

export const ClientMessageSchema = v.variant("type", [
  /** First message of the host. `ticket` + `expires` come from POST /api/new-code. */
  v.object({ type: v.literal("create"), nonce: v.optional(nonce), name: v.optional(text(64)), l: v.optional(look), ticket: text(256), expires: v.pipe(v.number(), v.integer()) }),
  v.object({ type: v.literal("join"), nonce: v.optional(nonce), name: v.optional(text(64)), l: v.optional(look) }),
  v.object({ type: v.literal("rejoin"), playerId: id, token, l: v.optional(look) }),
  /** A seated player changes their own avatar. */
  v.object({ type: v.literal("look"), l: look }),
  v.object({ type: v.literal("settings"), settings: SettingsSchema }),
  /** The word is never sent by a client: only how many intruders and which hint. */
  v.object({ type: v.literal("start"), imposters: v.optional(small), hint: v.optional(hint) }),
  /** A player looked at their card. */
  v.object({ type: v.literal("seen") }),
  /** Host: everybody has seen their card, start the discussion (the server picks who starts and when the wheel spins). */
  v.object({ type: v.literal("talk-start") }),
  /** Host: show who the intruders were and the word. */
  v.object({ type: v.literal("reveal") }),
  v.object({ type: v.literal("vote-open") }),
  v.object({ type: v.literal("vote"), suspectId: id }),
  v.object({ type: v.literal("vote-reveal") }),
  /** Question mode: the host or the player asking draws another question (`other`) or hands over to the next player (`next`). */
  v.object({ type: v.literal("question"), action: v.picklist(["next", "other"]), n: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))) }),
  v.object({ type: v.literal("outcome"), kind: v.picklist(["caught", "guessed", "escaped", "troll"]), escapedIds: v.optional(v.pipe(v.array(id), v.maxLength(12))) }),
  v.object({ type: v.literal("timer"), action: v.picklist(["start", "pause", "resume", "add"]) }),
  v.object({ type: v.literal("next-round") }),
  v.object({ type: v.literal("leave") })
]);

export type ClientMessage = v.InferOutput<typeof ClientMessageSchema>;
export type ClientMessageType = ClientMessage["type"];

export const CLIENT_MESSAGE_TYPES: readonly ClientMessageType[] = [
  "create", "join", "rejoin", "look", "settings", "start", "seen", "talk-start", "reveal", "vote-open", "vote", "vote-reveal", "question", "outcome", "timer", "next-round", "leave"
];

/** The seat a client gets back from create / join / rejoin. */
type Ack = { code: string; playerId: string; token: string; isHost: boolean };

/** What the server sends. `rev` rises with every broadcast: a client drops any state older than the one it has. */
export type ServerMessage =
  | ({ type: "created" } & Ack)
  | ({ type: "joined" } & Ack)
  | ({ type: "rejoined" } & Ack)
  | { type: "state"; rev: number; state: PublicState }
  | { type: "role"; role: Role }
  | { type: "delta"; delta: Record<string, number> }
  | { type: "error"; code: string; message: string };

export type ParseResult =
  | { ok: true; msg: ClientMessage }
  | { ok: false; code: "bad-message" | "bad-json" | "too-large" | "unknown-type"; message: string };

/** Size check (real bytes), JSON parse, then schema validation. Never throws. */
export function parseClientMessage(raw: unknown): ParseResult {
  if (typeof raw !== "string") return { ok: false, code: "bad-message", message: "Messages must be text." };
  if (exceedsLimit(raw)) return { ok: false, code: "too-large", message: "Message too large." };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, code: "bad-json", message: "Not valid JSON." };
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, code: "bad-json", message: "Not valid JSON." };
  const type = (json as { type?: unknown }).type;
  if (typeof type !== "string" || !(CLIENT_MESSAGE_TYPES as readonly string[]).includes(type)) {
    return { ok: false, code: "unknown-type", message: "Unrecognized message type." };
  }
  if (exceedsLimit(raw, type)) return { ok: false, code: "too-large", message: "Message too large." };
  const result = v.safeParse(ClientMessageSchema, json);
  if (!result.success) return { ok: false, code: "bad-message", message: `Invalid "${type}" message.` };
  return { ok: true, msg: result.output };
}
