/** publicState(): the whitelist of what every client may see (word, decoy and intruders are never in it before the reveal).  (see room-logic.ts) */
import { HIDDEN_TWISTS } from "../src/lib/game/twist-rules.ts";
import { timerView } from "./room-round.ts";
import { voteOf } from "./room-vote.ts";
import { type PublicState, type QuestionView, type RevealView, type Room, type TalkView, type VoteView } from "./types.ts";

/* ---------------- what everyone may see ---------------- */

function voteView(room: Room): VoteView | null {
  const v = voteOf(room);
  if (!v) return null;
  if (!v.revealed) return { revealed: false, voted: Object.keys(v.picks), picks: null, tally: null };
  const tally: Record<string, number> = {};
  for (const s of Object.values(v.picks)) tally[s] = (tally[s] || 0) + 1;
  return { revealed: true, voted: Object.keys(v.picks), picks: { ...v.picks }, tally };
}

/** Public, broadcast-safe snapshot: never includes the word, decoy, intruders, tokens or internal flags. */
export function publicState(room: Room, now: number): PublicState {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    round: room.round,
    settings: room.settings,
    timer: timerView(room, now),
    players: room.players.map((p) => ({ id: p.id, name: p.name, l: p.l, score: p.score, connected: p.connected })),
    vote: voteView(room),
    seen: room.phase === "round" && room.current ? [...room.current.seen] : null,
    dealt: room.phase === "round" && room.current ? [...room.current.playerIds] : null,
    talk: talkView(room, now),
    twist: twistView(room),
    question: questionView(room),
    reveal: revealView(room)
  };
}

/** The twist everybody sees on the discussion screen. The secret ones (double agent, extra intruder) wait for the reveal. */
function twistView(room: Room): string | null {
  const c = room.current;
  if (room.phase !== "round" || !c || !c.talk || !c.twist || HIDDEN_TWISTS.includes(c.twist)) return null;
  return c.twist;
}

function questionView(room: Room): QuestionView | null {
  const c = room.current;
  if (room.phase !== "round" || !c || !c.talk || c.revealed || !c.question) return null;
  return { askerId: c.question.askerId, q: c.question.q, n: c.question.n };
}

function talkView(room: Room, now: number): TalkView | null {
  const t = room.phase === "round" ? room.current?.talk : null;
  return t ? { starterId: t.starterId, sinceMs: now - t.startAt, wheel: t.wheel !== false } : null;
}

/** The ONLY place the word and the intruders leave the room state, and only once the host has revealed. */
function revealView(room: Room): RevealView | null {
  const c = room.current;
  if (room.phase !== "round" || !c || !c.revealed) return null;
  return { intruderIds: [...c.imposterIds], word: c.word, twin: c.twin, troll: c.troll, twist: c.twist, agentId: c.agentId, word2: c.word2, baseIntruders: c.baseIntruders };
}
