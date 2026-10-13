/**
 * Pure room state machine for online play (one device per player).
 * No I/O, no WebSocket, no Durable Object and no PartyKit imports here, on purpose: the networking layer
 * wraps this module, and the rules are verified with plain Vitest.
 *
 * Rules of this module:
 *  - Time and randomness come from the caller (`now`, `rng`), never from globals, so tests are exact.
 *  - Word packs are passed in (`packs`), so this file never imports the client's data files. (The only import from
 *    src/ is `game/intruders.ts`, a tiny pure function shared with the local game.)
 *  - Every function validates BEFORE it changes anything: a call that throws leaves the room untouched.
 *  - The word is always picked here, on the server. A client can only send `imposters` and `hint`.
 *
 * Dropped connections (phone lock, bad signal) and leaving on purpose are different things:
 *  - disconnect(): the player keeps their seat for GRACE_MS. Nothing else changes until sweep() runs.
 *  - leaveRoom():  an explicit leave. The seat is removed (lobby) or marked `left` (kept for scoring in a round).
 *
 * Host rule: the host seat is held for GRACE_MS. After that sweep() promotes the next connected player and
 * remembers the old host in `formerHostId`. The old host takes the role back by rejoining (see rejoinRoom),
 * but only while the interim host has done no host action (`interimActed`) and the old seat still exists.
 * In the lobby and on the scores screen a seat is removed once its owner has been gone longer than the grace
 * period, so there the claim ends with the seat. During a round seats are never removed.
 */

// Split by topic (one file per concern); this barrel keeps the public API (`import * as RL from "./room-logic.ts"`) unchanged.
// room-core: constants, RoomError, helpers, createRoom | room-members: join/leave/reconnect/sweep | room-vote | room-talk: card, wheel, reveal, questions
// room-settings: settings, custom words, pickWord | room-round: start/outcome/next + timer | room-view: publicState (what clients may see)

export { MIN_PLAYERS, MAX_PLAYERS, GRACE_MS, POINTS, MAX_TIMER_MS, TALK_LEAD_MS, WHEEL_TOTAL_MS, wheelEndsAt, TIMER_ACTIONS, RoomError, pickLook, cleanText, randomCode, uniqueName, createRoom, requirePlayer } from "./room-core.ts";
export { joinRoom, setLook, tokenOf, playerByNonce, disconnect, rejoinRoom, roleFor, leaveRoom, sweep, nextSweepAt } from "./room-members.ts";
export { openVote, castVote, revealVote } from "./room-vote.ts";
export { markSeen, startTalk, questionAction, revealRound } from "./room-talk.ts";
export { parseCustom, cleanWords, updateSettings, pickWord } from "./room-settings.ts";
export type { CustomEntry } from "./room-settings.ts";
export { startRound, resolveOutcome, nextRound, timerAction } from "./room-round.ts";
export { publicState } from "./room-view.ts";
export { REPEAT_WEIGHT } from "../src/lib/game/intruders.ts";
