/** The card, the shared wheel, the discussion start and reveal, and question mode.  (see room-logic.ts) */
import { questionPool } from "../src/lib/data/questions.ts";
import { MAX_TIMER_MS, RoomError, TALK_LEAD_MS, markHostAction, requireHost, requirePlayer, wheelEndsAt } from "./room-core.ts";
import { type Ctx, type Current, type Lang, type Room } from "./types.ts";

/* ---------------- the card, the shared wheel and the reveal ----------------
 * Everybody looks at their card on their own phone ("seen"); the host then starts the discussion: the server picks who
 * starts and a start time, so all phones spin the same wheel together and stop on the same person. Only when the host
 * reveals does the word and the list of intruders join the broadcast (see publicState). */

/** A dealt-in player looked at their card. Idempotent. */
export function markSeen(room: Room, id: string): Room {
  const c = room.current;
  if (room.phase !== "round" || !c) throw new RoomError("bad-phase", "No round in progress.");
  if (!c.playerIds.includes(id)) throw new RoomError("not-in-round", "You're not in this round.");
  if (!c.seen.includes(id)) c.seen.push(id);
  return room;
}

/** Host-only. Picks the starter (connected players first), fixes the wheel's start time (unless the host turned the wheel off) and starts the timer behind it. */
export function startTalk(room: Room, hostId: string, ctx: Ctx): Room {
  requireHost(room, hostId);
  const c = room.current;
  if (room.phase !== "round" || !c) throw new RoomError("bad-phase", "No round in progress.");
  if (c.talk || c.revealed) return room; // a double tap changes nothing
  const rng = ctx.rng ?? Math.random;
  const here = c.playerIds.filter((id) => room.players.some((p) => p.id === id && p.connected && !p.left));
  const pool = here.length ? here : c.playerIds;
  const starterId = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  // The wheel is the host's switch (on unless explicitly off). It is fixed here for the whole round, so a late change can't desync the phones.
  const wheel = room.settings?.wh !== false;
  const startAt = ctx.now + (wheel ? TALK_LEAD_MS : 0);
  c.talk = { starterId, startAt, wheel };
  const minutes = Number(room.settings?.minutes);
  // Blitz halves the discussion time. The timer starts behind the wheel (or right away when there is none).
  if (minutes > 0) room.timer = { endsAt: wheelEndsAt(c.talk) + Math.round(Math.min(minutes * 60000, MAX_TIMER_MS) / (c.twist === "blitz" ? 2 : 1)) };
  if (room.settings?.qm) {
    const question = { askerId: starterId, dir: (c.twist === "rev" ? -1 : 1) as 1 | -1, q: "", n: 0, deck: [] as string[] };
    drawQuestion(question, room.settings.lang, rng);
    c.question = question;
  }
  markHostAction(room);
  return room;
}

/* ---------------- question mode ----------------
 * The server holds the deck, so every phone shows the same question and the same asker. The host or the player who is
 * asking may draw the next one. */
function shuffled<T>(list: readonly T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawQuestion(q: NonNullable<Current["question"]>, lang: Lang, rng: () => number): void {
  if (!q.deck.length) {
    q.deck = shuffled(questionPool(lang), rng);
    if (q.deck.length > 1 && q.deck[q.deck.length - 1] === q.q) q.deck.unshift(q.deck.pop() as string);
  }
  q.q = q.deck.pop() ?? "";
  q.n += 1;
}

/** "next": the next player (in the round's direction, skipping anyone who is gone) asks a new question; "other": a new question, same asker. */
export function questionAction(room: Room, id: string, action: unknown, ctx: Ctx, n?: number): Room {
  requirePlayer(room, id);
  const c = room.current;
  if (room.phase !== "round" || !c || !c.question || !c.talk || c.revealed) throw new RoomError("bad-phase", "There are no questions right now.");
  if (action !== "next" && action !== "other") throw new RoomError("bad-action", "Unknown question action.");
  if (id !== room.hostId && id !== c.question.askerId) throw new RoomError("not-asker", "Only the host or the player asking can do that.");
  const q = c.question;
  // Two taps on the same question (the asker and the host, or a double tap) must not skip one: only the first counts.
  if (n !== undefined && n !== q.n) return room;
  if (action === "next") {
    const ids = c.playerIds;
    const at = ids.indexOf(q.askerId);
    for (let k = 1; k <= ids.length; k++) {
      const cand = ids[(((at + q.dir * k) % ids.length) + ids.length) % ids.length];
      const p = room.players.find((x) => x.id === cand);
      if (p && p.connected && !p.left) {
        q.askerId = cand;
        break;
      }
    }
  }
  drawQuestion(q, room.settings?.lang ?? "en", ctx.rng ?? Math.random);
  if (id === room.hostId) markHostAction(room);
  return room;
}

/** Host-only. Shows who the intruders were and what the word was. The outcome is picked after this. */
export function revealRound(room: Room, hostId: string): Room {
  requireHost(room, hostId);
  const c = room.current;
  if (room.phase !== "round" || !c) throw new RoomError("bad-phase", "No round in progress.");
  c.revealed = true;
  room.timer = null;
  markHostAction(room);
  return room;
}
