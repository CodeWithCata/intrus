/** Starting a round, resolving the outcome, next round, and the discussion timer.  (see room-logic.ts) */
import { pickIntruders } from "../src/lib/game/intruders.ts";
import { partnersAvailable } from "../src/lib/game/twins.ts";
import { pickTwist } from "../src/lib/game/twist-rules.ts";
import { HINTS, MAX_TIMER_MS, MIN_PLAYERS, POINTS, RoomError, TIMER_ACTIONS, isString, markHostAction, maxImposters, requireHost, wheelEndsAt } from "./room-core.ts";
import { roleFor, sweep } from "./room-members.ts";
import { pickWord } from "./room-settings.ts";
import { type Ctx, type Current, type Hint, type Role, type Room, type StartOptions, type TimerView } from "./types.ts";

/* ---------------- rounds ---------------- */

/**
 * Starts a round. The server picks the word; the client may only suggest `imposters` and `hint`.
 * Everything is validated first, so a rejected start (too few players, no words, wrong phase) changes nothing.
 * Only connected players are dealt in. Players inside their grace period keep their seat but sit this round out.
 * Returns { room, roles } where `roles` maps playerId -> Role.
 */
export function startRound(room: Room, hostId: string, opts: StartOptions, ctx: Ctx): { room: Room; roles: Record<string, Role> } {
  requireHost(room, hostId);
  if (room.phase !== "lobby" && room.phase !== "scores") throw new RoomError("bad-phase", "Round already running.");
  const rng = ctx.rng ?? Math.random;
  const active = room.players.filter((p) => p.connected && !p.left);
  if (active.length < MIN_PLAYERS) throw new RoomError("too-few", `Need at least ${MIN_PLAYERS} players.`);
  const picked = pickWord(room, ctx.packs, rng);
  if (!picked) throw new RoomError("no-word", "No words to pick from.");

  const wantedN = typeof opts.imposters === "number" && Number.isFinite(opts.imposters) ? Math.trunc(opts.imposters) : room.settings?.imposters ?? 1;
  const hint: Hint = HINTS.find((h) => h === opts.hint) ?? room.settings?.hint ?? "category";
  const n = Math.min(Math.max(1, wantedN), maxImposters(active.length));

  // Fairness: last round's intruders are less likely, not excluded, so the table can't rule anyone out (see below).
  let imposterIds = pickIntruders(active.map((p) => p.id), room.lastImposterIds, n, rng);

  // The game modes (each costs random numbers only when it is switched on, so a plain round draws exactly what it always did).
  const s = room.settings;
  const troll = !!s?.troll && active.length >= 4 && rng() < 0.2; // everybody is an intruder: a surprise round, nobody scores
  if (troll) imposterIds = active.map((p) => p.id);
  const twin = picked.twin;
  const known = !troll && twin === null && !!s?.kn && partnersAvailable(active.length, imposterIds.length);
  const baseIntruders = imposterIds.length;
  let twist: string | null = null;
  let agentId: string | null = null;
  let word2: string | null = null;
  if (!troll && s?.tw) {
    twist = pickTwist({ last: room.lastTwist, questions: !!s.qm, timer: Number(s.minutes) > 0, twin: twin !== null, players: active.length, intruders: imposterIds.length, related: picked.related.length }, rng);
    const civilians = active.map((p) => p.id).filter((id) => !imposterIds.includes(id));
    if (twist === "ex") imposterIds = [...imposterIds, civilians[Math.floor(rng() * civilians.length)]];
    if (twist === "ag") {
      agentId = civilians[Math.floor(rng() * civilians.length)];
      word2 = picked.related[Math.floor(rng() * picked.related.length)];
    }
  }

  // ---- everything is valid: from here on we only change state ----
  sweep(room, ctx.now); // drops players who left or were gone past the grace period
  room.used = picked.used;
  room.lastImposterIds = troll ? [] : imposterIds;
  if (twist) room.lastTwist = twist;
  room.round += 1;
  room.phase = "round";
  room.timer = null;
  const current: Current = {
    imposterIds, playerIds: active.map((p) => p.id), category: picked.category, decoy: picked.decoy || null, word: picked.word, hint, vote: null, seen: [], talk: null, revealed: false,
    troll, twin, twist, agentId, word2, known, customHint: picked.customHint, baseIntruders, question: null
  };
  room.current = current;
  markHostAction(room);

  const roles: Record<string, Role> = {};
  for (const p of active) {
    const role = roleFor(room, p.id);
    if (role) roles[p.id] = role;
  }
  return { room, roles };
}

/**
 * Resolves a round. `escapedIds` only matters for "escaped" with 2+ intruders: intruders not listed count as caught.
 * Returns { room, delta } where delta maps playerId -> points.
 */
export function resolveOutcome(room: Room, hostId: string, kind: unknown, escapedIds?: unknown): { room: Room; delta: Record<string, number> } {
  requireHost(room, hostId);
  if (room.phase !== "round" || !room.current) throw new RoomError("bad-phase", "No round in progress.");
  // The outcome is picked on the reveal screen: nobody can score a round whose intruders have not been shown.
  if (!room.current.revealed) throw new RoomError("not-revealed", "Reveal the intruders first.");
  if (kind !== "caught" && kind !== "guessed" && kind !== "escaped" && kind !== "troll") throw new RoomError("bad-kind", "Unknown outcome.");
  const cur = room.current;
  // A troll round can only end as one (nobody scores); a twin-words round has no word to guess (nobody knows they are an intruder).
  if ((kind === "troll") !== cur.troll) throw new RoomError("bad-kind", cur.troll ? "A troll round has no winner." : "That outcome is only for a troll round.");
  if (kind === "guessed" && cur.twin !== null) throw new RoomError("bad-kind", "With twin words nobody can guess the word.");
  const pts = POINTS[kind];
  const mult = cur.twist === "dbl" ? 2 : 1; // "Double or nothing": the round's points count twice
  const escaped = new Set(Array.isArray(escapedIds) ? escapedIds.filter(isString) : []);
  const imposters = new Set(room.current.imposterIds);
  const dealtIn = new Set(room.current.playerIds);
  const delta: Record<string, number> = {};
  for (const p of room.players) {
    if (!dealtIn.has(p.id)) delta[p.id] = 0; // wasn't part of this round
    else if (!imposters.has(p.id)) delta[p.id] = pts.crew * mult;
    else delta[p.id] = (kind === "escaped" && imposters.size > 1 && !escaped.has(p.id) ? POINTS.caught.intruder : pts.intruder) * mult;
  }
  for (const p of room.players) p.score += delta[p.id] || 0;
  room.phase = "scores";
  room.current = null;
  room.timer = null;
  markHostAction(room);
  return { room, delta };
}

/** Back to the lobby for the next round; scores and settings carry over. Players who left or timed out are removed. */
export function nextRound(room: Room, hostId: string, now: number): Room {
  requireHost(room, hostId);
  if (room.phase !== "scores") throw new RoomError("bad-phase", "No scores to move on from.");
  room.phase = "lobby";
  sweep(room, now);
  markHostAction(room);
  return room;
}

/* ---------------- discussion timer ----------------
 * The server is the single source of truth, but never sends absolute timestamps: phones' clocks disagree by
 * seconds. publicState() reports `remainingMs` as of the moment it is built and each client counts down from
 * when the message arrived (error = network latency). `now` is a parameter so the maths is testable. */
export function timerView(room: Room, now: number): TimerView | null {
  const t = room.timer;
  if (!t || room.phase !== "round") return null;
  if ("endsAt" in t) return t.endsAt > now ? { status: "running", remainingMs: t.endsAt - now } : { status: "up", remainingMs: 0 };
  return t.remainingMs > 0 ? { status: "paused", remainingMs: t.remainingMs } : { status: "up", remainingMs: 0 };
}

/**
 * Host-only. start: begin the room's configured minutes (no-op if already running/paused);
 * pause / resume: no-ops when they don't apply, so a stale double-tap is harmless;
 * add: +1 minute to a running or paused timer, or a fresh one-minute timer after time is up.
 */
export function timerAction(room: Room, hostId: string, action: unknown, now: number): Room {
  requireHost(room, hostId);
  if (!TIMER_ACTIONS.some((a) => a === action)) throw new RoomError("bad-action", "Unknown timer action.");
  if (room.phase !== "round") throw new RoomError("bad-phase", "No round in progress.");
  const minutes = Number(room.settings?.minutes);
  if (!(minutes > 0)) throw new RoomError("no-timer", "The timer is off for this game.");
  markHostAction(room);

  const view = timerView(room, now);
  const status = view ? view.status : "none";
  const cap = (ms: number): number => Math.min(ms, MAX_TIMER_MS);
  const t = room.timer;

  // Pausing while the opening wheel still turns would pause time the wheel has not used up yet (and every phone would show a different clock).
  const wheelEnd = room.current?.talk ? wheelEndsAt(room.current.talk) : 0;
  if (action === "pause" && now < wheelEnd) return room;

  if (action === "start") {
    if (status === "running" || status === "paused") return room;
    room.timer = { endsAt: now + cap(minutes * 60000) };
  } else if (action === "pause") {
    if (!view || status !== "running") return room;
    room.timer = { remainingMs: view.remainingMs };
  } else if (action === "resume") {
    if (!view || status !== "paused") return room;
    room.timer = { endsAt: now + view.remainingMs };
  } else if (action === "add") {
    if (view && status === "running" && t && "endsAt" in t) room.timer = { endsAt: t.endsAt + (cap(view.remainingMs + 60000) - view.remainingMs) };
    else if (view && status === "paused") room.timer = { remainingMs: cap(view.remainingMs + 60000) };
    else room.timer = { endsAt: now + 60000 };
  }
  return room;
}
