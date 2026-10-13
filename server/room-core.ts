/** Room constants, RoomError, text/look helpers, createRoom and the host/player guards. Everything else in server/room-*.ts builds on this.  (see room-logic.ts) */
import { AVATAR_COUNT, indexToCode, isLookCode } from "../src/lib/components/players/avatar-parts.ts";
import { WHEEL_MS, WHEEL_SETTLE_MS } from "../src/lib/game/wheel.ts";
import { type Hint, type Outcome, type Player, type Room, type TimerAction } from "./types.ts";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
/** How long a dropped connection keeps its seat (and the host its role). */
export const GRACE_MS = 45_000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 characters, no 0/O/1/I

export const POINTS: Record<Outcome, { crew: number; intruder: number }> = {
  caught: { crew: 1, intruder: 0 },
  guessed: { crew: 0, intruder: 1 },
  escaped: { crew: 0, intruder: 2 },
  troll: { crew: 0, intruder: 0 }
};

export const MAX_NAME = 24;
export const CUSTOM_MAX = 100;
export const WORD_MAX = 30;
export const CATEGORY_MAX = 24;
export const HINT_MAX = 40;
export const MAX_USED = 400;
export const HINTS: readonly Hint[] = ["category", "letter", "related", "none"];
export const MINUTES = [0, 1, 2, 3, 5];
export const MAX_TIMER_MS = 30 * 60 * 1000;
/** The shared wheel starts this long after the host starts the discussion (time for every phone to get the message). */
export const TALK_LEAD_MS = 1200;
/** The discussion timer starts when the wheel has stopped and settled, so the wheel does not eat into the talk time. */
export const WHEEL_TOTAL_MS = WHEEL_MS + WHEEL_SETTLE_MS;
/**
 * When the opening wheel is over (server clock, ms). Without a wheel that is `startAt` itself. Only an explicit `false` means "no
 * wheel": a round saved before the switch existed has no flag, and it had a wheel.
 */
export const wheelEndsAt = (talk: { startAt: number; wheel?: boolean }): number => (talk.wheel === false ? talk.startAt : talk.startAt + WHEEL_TOTAL_MS);
export const TIMER_ACTIONS: readonly TimerAction[] = ["start", "pause", "resume", "add"];


export class RoomError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/* ---------------- small helpers ---------------- */

/**
 * The look code the player chose when it is valid (twins are allowed, like in the local game), else the first
 * of the original looks nobody in the room wears.
 */
export function pickLook(taken: number[], wanted: unknown): number {
  if (isLookCode(wanted)) return wanted;
  for (let a = 0; a < AVATAR_COUNT; a++) {
    const code = indexToCode(a);
    if (!taken.includes(code)) return code;
  }
  return indexToCode(0);
}

const newToken = (): string => crypto.randomUUID();
export const maxImposters = (n: number): number => Math.max(1, Math.floor((n - 1) / 2));
export const isString = (x: unknown): x is string => typeof x === "string";

/**
 * Cleans a display string typed by a player (name, list name, word) before everyone else sees it:
 *  - NFKC normalisation (full-width and compatibility forms become plain letters),
 *  - control characters and invisible formatting characters are removed: zero-width space, word joiner, BOM, soft
 *    hyphen and the bidi marks / overrides / isolates that can reorder or hide text. U+200C and U+200D stay, because
 *    some scripts and emoji sequences need them,
 *  - line / paragraph separators and runs of whitespace become one space,
 *  - the result is cut to `max` code points (never in the middle of an emoji) and trimmed.
 * Returns `fallback` when nothing visible is left.
 */
export function cleanText(raw: unknown, max: number, fallback = ""): string {
  const s = (isString(raw) ? raw : raw == null ? "" : String(raw))
    .normalize("NFKC")
    .replace(/[\p{Zl}\p{Zp}]/gu, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\u200C" || c === "\u200D" ? c : ""))
    .replace(/\s+/g, " ")
    .trim();
  const cut = Array.from(s).slice(0, max).join("").trim();
  return cut || fallback;
}

/** A room code from the given random source. T3 passes a crypto-backed source; tests pass a fixed one. */
export function randomCode(rng: () => number, length = 6): string {
  let s = "";
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return s;
}

export function uniqueName(existing: string[], name: string): string {
  const used = new Set(existing.map((n) => n.toLowerCase()));
  let cand = name;
  for (let k = 2; used.has(cand.toLowerCase()); k++) cand = name + " (" + k + ")";
  return cand;
}

export function makePlayer(id: string, name: string, l: number): Player {
  return { id, name, l, score: 0, connected: true, disconnectedAt: null, left: false, token: newToken() };
}

/** A fresh room. `code` and `hostId` are supplied by the caller. */
export function createRoom(code: string, hostId: string, hostName?: unknown, look?: unknown): Room {
  const name = uniqueName([], cleanText(hostName, MAX_NAME, "Host"));
  return {
    code,
    hostId,
    formerHostId: null,
    interimActed: false,
    phase: "lobby",
    players: [makePlayer(hostId, name, pickLook([], look))],
    settings: null,
    customWords: [],
    used: [],
    round: 0,
    lastImposterIds: [],
    lastTwist: null,
    timer: null,
    current: null
  };
}

export function requireHost(room: Room, id: string): void {
  if (room.hostId !== id) throw new RoomError("not-host", "Only the host can do that.");
}

/** Call at the end of every successful host action: it ends a displaced host's claim to the role. */
export function markHostAction(room: Room): void {
  if (room.formerHostId) room.interimActed = true;
}

export function requirePlayer(room: Room, id: string): Player {
  const p = room.players.find((x) => x.id === id);
  if (!p) throw new RoomError("not-in-room", "You're not in this room.");
  return p;
}
