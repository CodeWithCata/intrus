/**
 * Reactive wrapper around OnlineClient (online/client.ts). Components read `online` directly (no refresh calls) and
 * call the functions below from `onclick`. It also drives navigation: when the server starts a round everybody is taken
 * to the "online" screen, and back to setup (with the room sheet open) when the lobby comes back or the room closes.
 *
 * Online play is OFF unless the build has VITE_PARTY_HOST (the game server's host, e.g. "intrus-party.me.workers.dev").
 */
import { OnlineClient, IDLE, type Snapshot } from "./client.ts";
import { codeFromShare, codeFromText, ignoredFeatures, joinLink, loadName, saveName, serverHost, settingsFromApp } from "./room.ts";
import { CATEGORIES } from "#lib/data/words/index.ts";
import type { ClientMessage } from "./protocol.ts";
import { go, nav } from "#lib/stores/nav.svelte.ts";
import { state as app } from "#lib/stores/settings.svelte.ts";
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { playerName } from "#lib/stores/players.svelte.ts";
import { playerCode } from "#lib/components/players/avatar-parts.ts";
import { t } from "#lib/i18n/index.svelte.ts";
import type { MessageKey } from "#lib/i18n/ro.ts";
import { clearBadge, setBadge } from "#lib/utils/app-badge.ts";
import { syncTalkClock } from "#lib/stores/talk.svelte.ts";
import { WHEEL_MS, WHEEL_SETTLE_MS } from "#lib/game/wheel.ts";
import { untrack } from "svelte";

/** This device's avatar: the drawn look of the first local player (the same one the name falls back to). Photos are never sent. */
export const myLook = (): number | undefined => (app.players[0] ? playerCode(app.players[0]) : undefined);

const client = new OnlineClient({ host: serverHost(), name: () => loadName() || playerName(0), look: myLook });

export const onlineAvailable = client.available;

/** The reactive copy of the client's snapshot. */
export const online: Snapshot = $state({ ...IDLE });

/** Ticks while a round timer runs, so `remainingMs()` re-renders. */
export const clock = $state({ now: Date.now() });
let tickTimer: ReturnType<typeof setInterval> | null = null;

const MIN_CONNECTED = 3;

export const isHost = (): boolean => !!online.playerId && online.state?.hostId === online.playerId;
export const inRoom = (): boolean => online.status === "in" || online.status === "reconnecting" || online.status === "connecting";
export const connectedCount = (): number => online.state?.players.filter((p) => p.connected).length ?? 0;
export const canStart = (): boolean => isHost() && online.state?.phase === "lobby" && connectedCount() >= MIN_CONNECTED;
/** Features switched on in this device that online play ignores (twists, questions, troll, custom words, groups). */
export const ignoredNow = (): MessageKey[] => ignoredFeatures(app);
export const roomLink = (): string => (online.code ? joinLink(location.origin, online.code) : "");

/**
 * The shared wheel of this round on THIS device's clock: the server only says how long ago (or in how long) it starts as of a
 * message, so no phone clock has to agree with another. Fixed the first time a round's `talk` arrives and kept after that.
 */
/** Everybody's score when this round began, so the scoreboard can show +N to every phone (the server only tells the host). */
export const startScores = $state<{ round: number; scores: Record<string, number> }>({ round: 0, scores: {} });

export const talkLocal = $state({ round: 0, startAt: 0 });
/** True while the wheel is still to be shown: the host left it on, and it has not finished (a phone that arrives after it, e.g. after a refresh, skips it). */
export const wheelPending = (): boolean => {
  const s = online.state;
  return !!s?.talk && s.talk.wheel !== false && talkLocal.round === s.round && Date.now() - talkLocal.startAt < WHEEL_MS + WHEEL_SETTLE_MS;
};

/** Seconds-accurate remaining time of the discussion timer (null = no timer). The time the wheel still needs is not counted (none when the host turned the wheel off). */
export function remainingMs(): number | null {
  const t = online.state?.timer;
  if (!t) return null;
  if (t.status !== "running") return t.remainingMs;
  const left = Math.max(0, t.remainingMs - (clock.now - online.stateAt));
  const hasWheel = online.state?.talk?.wheel !== false;
  const wheelLeft = hasWheel && online.state && talkLocal.round === online.state.round ? Math.max(0, WHEEL_MS + WHEEL_SETTLE_MS - (clock.now - talkLocal.startAt)) : 0;
  return Math.max(0, left - wheelLeft);
}

/** The ring, the clock and the dimming of the discussion screen follow the server's timer (see stores/talk.svelte.ts). */
$effect.root(() => {
  $effect(() => {
    const rem = remainingMs();
    const paused = online.state?.timer?.status === "paused";
    untrack(() => syncTalkClock(rem, paused));
  });
});

let lastPhase: string | null = null;

/** While seated in a room, an avatar change made in the builder is sent to the server (once; the echo makes them equal). */
$effect.root(() => {
  $effect(() => {
    const l = myLook();
    const me = online.state?.players.find((p) => p.id === online.playerId);
    if (online.status === "in" && l !== undefined && me && me.l !== l) client.send({ type: "look", l });
  });
});

client.subscribe(() => {
  const s = client.snapshot;
  const prevStatus = online.status;
  Object.assign(online, s);
  if (s.state?.phase === "round" && startScores.round !== s.state.round) {
    startScores.round = s.state.round;
    startScores.scores = Object.fromEntries(s.state.players.map((p) => [p.id, p.score]));
  }
  const tk = s.state?.talk;
  if (tk && s.state && talkLocal.round !== s.state.round) {
    talkLocal.round = s.state.round;
    talkLocal.startAt = s.stateAt - tk.sinceMs;
  } else if (!tk && talkLocal.round) {
    talkLocal.round = 0;
  }

  const wantTick = s.state?.timer?.status === "running";
  if (wantTick && !tickTimer) {
    clock.now = Date.now();
    tickTimer = setInterval(() => (clock.now = Date.now()), 250);
  } else if (!wantTick && tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }

  const phase = s.status === "in" || s.status === "reconnecting" ? (s.state?.phase ?? null) : null;
  if (phase !== lastPhase) {
    const was = lastPhase;
    lastPhase = phase;
    if ((phase === "round" || phase === "scores") && document.hidden) setBadge(1);
    if ((phase === "round" || phase === "scores") && nav.screen !== "online") {
      app.sheet = null;
      go("online");
    } else if (phase === "lobby" && was && was !== "lobby" && nav.screen === "online") {
      go("setup");
      app.sheet = "online";
    }
  }
  if (s.status === "closed" && prevStatus !== "closed") {
    lastPhase = null;
    if (s.error) toast(t(s.error));
    if (nav.screen === "online") go("setup");
  }
});

/* ---------------- actions ---------------- */

export function setName(name: string): void {
  saveName(name);
}
export const savedName = (): string => loadName() || playerName(0);

export function createRoom(name: string): Promise<void> {
  saveName(name.trim());
  return client.create();
}
export function joinRoom(code: string, name: string): void {
  saveName(name.trim());
  client.join(code);
}
export function leaveRoom(): void {
  client.leave();
  if (nav.screen === "online") go("setup");
}
export const send = (msg: ClientMessage): boolean => client.send(msg);

/** Host: send the app's current settings, then start. (The server picks the word and the intruders.) */
export function startOnlineRound(): void {
  const s = settingsFromApp(app, CATEGORIES);
  client.send({ type: "settings", settings: s });
  client.send({ type: "start", imposters: s.imposters, hint: s.hint });
}

/* ---------------- boot ---------------- */

let pendingCode: string | null = null;

/** Called by the /online/[room] route (before boot runs): remember the invitation until the app is up. */
export function setPendingJoin(code: string | null): void {
  pendingCode = code;
}

/**
 * Called once at the end of boot(): resume a saved seat, or open the join sheet for an invitation link.
 * `localGameRestored`: boot just put the player back into an unfinished local game, which must not be replaced by the online room.
 */
export function initOnline(localGameRestored = false): void {
  if (!onlineAvailable) return;
  const fromQuery = codeFromText(location.search) ?? codeFromShare(location.search);
  if (fromQuery) history.replaceState(null, "", location.pathname);
  const invite = pendingCode ?? fromQuery;
  pendingCode = null;
  if (invite) {
    app.ol = 1;
    app.code = invite;
    app.sheet = "online";
  } else if (!localGameRestored) {
    client.resume();
  }
  addEventListener("online", () => client.nudge());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      client.nudge();
      clearBadge();
    }
  });
}
