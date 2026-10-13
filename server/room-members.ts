/** Joining, leaving, reconnecting, grace period, host reclaim and the sweep that removes expired seats.  (see room-logic.ts) */
import { isLookCode } from "../src/lib/components/players/avatar-parts.ts";
import { GRACE_MS, MAX_NAME, MAX_PLAYERS, RoomError, cleanText, makePlayer, pickLook, requirePlayer, uniqueName } from "./room-core.ts";
import { revealVoteIfComplete } from "./room-vote.ts";
import { type Player, type Role, type Room } from "./types.ts";

/* ---------------- joining, leaving, reconnecting ---------------- */

export function joinRoom(room: Room, id: string, name?: unknown, look?: unknown): Room {
  if (room.players.some((p) => p.id === id)) return room; // idempotent (e.g. duplicate message)
  if (room.phase !== "lobby") throw new RoomError("in-progress", "This game has already started.");
  if (room.players.length >= MAX_PLAYERS) throw new RoomError("full", "This room is full.");
  const uniq = uniqueName(room.players.map((p) => p.name), cleanText(name, MAX_NAME, "Player"));
  room.players.push(makePlayer(id, uniq, pickLook(room.players.map((p) => p.l), look)));
  return room;
}

/** A player changes their own avatar (any phase: it is cosmetic). An invalid code is refused and nothing changes. */
export function setLook(room: Room, id: string, look: unknown): Room {
  const p = requirePlayer(room, id);
  if (!isLookCode(look)) throw new RoomError("bad-look", "That avatar isn't valid.");
  p.l = look;
  return room;
}

/** The seat a create / join attempt already made (same client nonce), if any. */
export function playerByNonce(room: Room, nonce: string): Player | null {
  return room.players.find((p) => p.nonce === nonce) ?? null;
}

/** Private credential handed to a player on join. Never part of publicState(). */
export function tokenOf(room: Room, id: string): string | null {
  return room.players.find((x) => x.id === id)?.token ?? null;
}

/** The next connected player in join order who could become host. */
const successor = (room: Room, exceptId: string): Player | undefined =>
  room.players.find((p) => p.id !== exceptId && p.connected && !p.left);

/** The socket dropped. The player keeps their seat for the grace period; sweep() decides later. */
export function disconnect(room: Room, id: string, now: number): void {
  const p = room.players.find((x) => x.id === id);
  if (!p || !p.connected) return;
  p.connected = false;
  p.disconnectedAt = now;
  revealVoteIfComplete(room);
}

/**
 * Re-attaches a dropped player to their seat (score and role intact). Returns true on success.
 * Refuses a bad token, an unknown seat (already removed) and a player who left on purpose.
 * If this player is the displaced host and the interim host has done nothing yet, the host role comes back.
 */
export function rejoinRoom(room: Room, id: string, token: string, look?: unknown): boolean {
  const p = room.players.find((x) => x.id === id);
  if (!p || p.left || !token || p.token !== token) return false;
  if (isLookCode(look)) p.l = look; // the device may have a newer avatar than the seat remembers
  p.connected = true;
  p.disconnectedAt = null;
  if (room.formerHostId === id) {
    if (!room.interimActed) room.hostId = id;
    room.formerHostId = null;
    room.interimActed = false;
  }
  return true;
}

/**
 * The private role of one player in the round in progress (also used to restore it after a reconnect).
 *  - Twin words: nobody is told they are an intruder; the intruders just hold the similar word.
 *  - Double agent: that civilian holds the related word and thinks it is the word.
 *  - Known partners: an intruder also gets the ids of the other intruders.
 * Hint modes limit an intruder: "category" gets the category, "related" the decoy, "letter" the first letter, "none" nothing.
 */
export function roleFor(room: Room, id: string): Role | null {
  const c = room.current;
  if (room.phase !== "round" || !c || !c.playerIds.includes(id)) return null;
  const isIntruder = c.imposterIds.includes(id);
  if (c.twin !== null) {
    // The troll variant of twin words: everybody holds the same word.
    const word = isIntruder && !c.troll ? c.twin : c.word;
    return { isIntruder: false, word, category: c.category, decoy: null, hint: c.hint, letter: null, mates: [], customHint: null };
  }
  const letter = isIntruder && c.hint === "letter" ? c.word.charAt(0).toUpperCase() : null;
  const word = isIntruder ? null : c.agentId === id && c.word2 ? c.word2 : c.word;
  const mates = isIntruder && c.known ? c.imposterIds.filter((x) => x !== id) : [];
  // An intruder learns only what the hint mode promises: the category, or a related word, or a letter, or nothing.
  const category = isIntruder && c.hint !== "category" ? null : c.category;
  const decoy = isIntruder && c.hint === "related" ? c.decoy : null;
  return { isIntruder, word, category, decoy, hint: c.hint, letter, mates, customHint: isIntruder ? c.customHint : null };
}

/**
 * An explicit leave (the player pressed leave). In the lobby the seat disappears. Otherwise it is marked
 * `left` (kept only while a round runs, so the score still counts) and cannot be taken back.
 * If the host leaves, the next connected player becomes host at once (no grace, no claim to return).
 * Returns the new hostId if it changed, else null.
 */
export function leaveRoom(room: Room, id: string): string | null {
  const p = room.players.find((x) => x.id === id);
  if (!p) return null;
  if (room.phase === "lobby") {
    room.players = room.players.filter((x) => x.id !== id);
  } else {
    p.connected = false;
    p.left = true;
    p.disconnectedAt = null;
  }
  revealVoteIfComplete(room);
  if (room.formerHostId === id) {
    room.formerHostId = null;
    room.interimActed = false;
  }
  if (room.hostId === id) {
    const next = successor(room, id);
    room.hostId = next ? next.id : null;
    room.formerHostId = null;
    room.interimActed = false;
    return room.hostId;
  }
  return null;
}

const expired = (p: Player, now: number, graceMs: number): boolean =>
  !p.connected && (p.left || (p.disconnectedAt !== null && now - p.disconnectedAt >= graceMs));

/**
 * Applies the grace period. Call it before handling a message and when the alarm fires.
 *  1. A host gone longer than the grace period is replaced by the next connected player (if there is one;
 *     otherwise the seat is simply held).
 *  2. Outside a round, players gone longer than the grace period (and players who left) are removed.
 * Returns who was removed and whether the host changed, so the caller knows whether to broadcast.
 */
export function sweep(room: Room, now: number, graceMs = GRACE_MS): { removed: string[]; hostChanged: boolean } {
  let hostChanged = false;
  const host = room.players.find((p) => p.id === room.hostId);
  if (host && expired(host, now, graceMs)) {
    const next = successor(room, host.id);
    if (next) {
      // Keep an earlier displaced host's claim while nobody has acted yet; otherwise the host just displaced gets it.
      if (!(room.formerHostId && !room.interimActed)) room.formerHostId = host.id;
      room.interimActed = false;
      room.hostId = next.id;
      hostChanged = true;
    }
  }
  const removed: string[] = [];
  if (room.phase !== "round") {
    room.players = room.players.filter((p) => {
      if (p.id === room.hostId || !expired(p, now, graceMs)) return true;
      removed.push(p.id);
      return false;
    });
  }
  if (room.formerHostId && !room.players.some((p) => p.id === room.formerHostId)) {
    room.formerHostId = null;
    room.interimActed = false;
  }
  return { removed, hostChanged };
}

/** The earliest time sweep() will have something to do (for the caller's alarm), or null if nothing is pending. */
export function nextSweepAt(room: Room, graceMs = GRACE_MS): number | null {
  let best: number | null = null;
  for (const p of room.players) {
    if (p.connected || p.left || p.disconnectedAt === null) continue;
    const hostNeedsReplacing = p.id === room.hostId && successor(room, p.id) !== undefined;
    const removable = room.phase !== "round" && p.id !== room.hostId;
    if (!hostNeedsReplacing && !removable) continue;
    const at = p.disconnectedAt + graceMs;
    if (best === null || at < best) best = at;
  }
  return best;
}
