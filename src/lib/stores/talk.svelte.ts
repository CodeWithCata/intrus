/**
 * The discussion countdown. `talkClock` is the reactive view (TimerRing and TalkControls bind to it);
 * the interval, the end timestamp and the pause bookkeeping stay private to this module.
 */
import { TK, TKE } from "#lib/audio/tick-styles.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { lowAlert } from "#lib/audio/drama-sounds.ts";
import { entersLowZone, heartbeat, LOW_SECONDS } from "#lib/game/tension.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { t as tl } from "#lib/i18n/index.svelte.ts";

export const talkClock = $state({
    /** Whole seconds left (can reach 0). */
    t: 0,
    /** Fraction of the current length that is left, 0..1: drives the ring. Updated every tick, not only every second. */
    frac: 1,
    paused: false,
    /** Incremented whenever a second elapses; the ring restarts its "ping" animation on each change. */
    pings: 0,
    /** Incremented when the last seconds begin (the dimming starts): TimerRing flashes a red pulse on each change. 0 = not yet. */
    alerts: 0,
    /** Text for the screen-reader live region (TimerRing). Changes only at sensible moments, not every second. */
    say: "",
    /** End time (ms since epoch) while running, 0 otherwise; saved with the game so a reload resumes the countdown. */
    talkEnd: 0,
    /** Milliseconds left while paused, 0 otherwise (saved with the game). */
    talkRem: 0
});

/** "2 minute", "1 minut", "30 de secunde", "1 minut și 30 de secunde". */
export const spokenTime = (s: number): string => {
    const m = Math.floor(s / 60), r = s % 60;
    const mm = m === 1 ? tl("tmMin1") : tl("tmMins", { m });
    const ss = r === 1 ? tl("tmSec1") : r < 20 || tl("tmSecsDe", { r }) === tl("tmSecs", { r }) ? tl("tmSecs", { r }) : tl("tmSecsDe", { r });
    return m && r ? tl("tmAnd", { a: mm, b: ss }) : m ? mm : ss;
};

/**
 * What to announce when the clock moves from `from` to `to` seconds: every full minute, at 30 s
 * and at 10 s, and when time is up. Returns "" for the ticks in between, so a screen reader is
 * not read to every second (the visible clock has no live region of its own).
 */
export const announcement = (from: number, to: number): string => {
    if (to <= 0 && from > 0) {
        return tl("tmUp");
    }
    for (let x = from - 1; x >= Math.max(to, 1); x--) {
        if (x % 60 === 0 || x === 30 || x === 10) {
            return tl("tmLeft", { t: spokenTime(x) });
        }
    }
    return "";
};

let introSay: ReturnType<typeof setTimeout> | undefined;

let total = 0, end = 0, rem = 0, id: ReturnType<typeof setInterval> | undefined;

/** Milliseconds left right now (frozen while paused). */
const msLeft = () => talkClock.paused ? rem : Math.max(0, end - Date.now());

const paintRing = () => {
    talkClock.frac = msLeft() / (total * 1000);
};

export const stopTalkTimer = () => {
    clearTimeout(introSay);
    clearInterval(id);
    id = undefined;
};

const run = () => {
    if (talkClock.paused) {
        return;
    }
    const p = talkClock.t, t = Math.ceil((end - Date.now()) / 1000);
    talkClock.t = t;
    if (t < p && t > 0) {
        TK(t <= 10);
        if (entersLowZone(p, t) && !state.rx) {
            // "Lumina se stinge" begins: a short sound and a red pulse on the ring so the players notice (not in relaxed mode)
            talkClock.alerts++;
            lowAlert();
        }
        if (t <= LOW_SECONDS) {
            // "Lumina se stinge": a heartbeat that speeds up as the time runs out (follows the vibration setting; one soft pulse when relaxed)
            vibrate(heartbeat(t, state.rx));
        }
    }
    paintRing();
    if (t < p) {
        talkClock.pings++;
        talkClock.say = announcement(p, t) || talkClock.say;
    }
    if (t <= 0) {
        stopTalkTimer();
        TKE();
        vibrate([200, 100, 200]);
    }
};

/** Starts (or restarts) the countdown from `seconds`. */
export function startTalkTimer(seconds: number) {
    stopTalkTimer();
    total = seconds;
    end = Date.now() + seconds * 1000;
    rem = 0;
    Object.assign(talkClock, { t: seconds, frac: 1, paused: false, pings: 0, alerts: 0, say: "", talkEnd: end, talkRem: 0 });
    id = setInterval(run, 250);
    // The live region only announces changes made after it is on screen, so wait for the mount.
    introSay = setTimeout(() => (talkClock.say = `Timp de discuție: ${spokenTime(seconds)}`), 800);
}

/**
 * Restarts the countdown of a restored game from its saved end timestamp (`endTs`), or from the
 * milliseconds left (`remMs`) when it was paused. `seconds` is the full length, only used for the ring.
 */
export function resumeTalkTimer(endTs: number, remMs: number, seconds: number) {
    stopTalkTimer();
    const paused = endTs <= 0 && remMs > 0;
    const left = paused ? remMs : Math.max(0, endTs - Date.now());
    total = Math.max(seconds, Math.ceil(left / 1000));
    end = paused ? Date.now() + left : endTs;
    rem = paused ? left : 0;
    Object.assign(talkClock, { t: Math.ceil(left / 1000), frac: left / (total * 1000), paused, pings: 0, alerts: 0, say: "", talkEnd: paused ? 0 : endTs, talkRem: paused ? left : 0 });
    if (left > 0) {
        id = setInterval(run, 250);
    }
}

export function togglePause() {
    if (talkClock.t <= 0) {
        return;
    }
    talkClock.paused = !talkClock.paused;
    talkClock.say = talkClock.paused ? tl("tmPaused") : tl("tmResumed", { t: spokenTime(Math.max(talkClock.t, 0)) });
    if (talkClock.paused) {
        rem = end - Date.now();
        talkClock.talkEnd = 0;
        talkClock.talkRem = rem;
    }
    else {
        end = Date.now() + rem;
        talkClock.talkEnd = end;
        talkClock.talkRem = 0;
    }
}

let syncTotal = 0;

/**
 * Online: the server owns the timer, this only SHOWS it. Called every few hundred ms with the milliseconds left (null = no timer);
 * it drives the same `talkClock` as the local countdown (ring, clock, ticks, the dimming alert and the heartbeat), without a countdown of its own.
 */
export function syncTalkClock(msLeft: number | null, paused: boolean) {
    if (msLeft === null) {
        syncTotal = 0;
        Object.assign(talkClock, { t: 0, frac: 1, paused: false, pings: 0, alerts: 0, say: "" });
        return;
    }
    syncTotal = Math.max(syncTotal, msLeft, 1000);
    const p = talkClock.t, t = Math.ceil(msLeft / 1000);
    talkClock.t = t;
    talkClock.paused = paused;
    talkClock.frac = Math.min(1, msLeft / syncTotal);
    if (paused || p === 0 || t >= p) {
        if (t > p && p > 0) {
            talkClock.say = tl("tmLeft", { t: spokenTime(t) });
        }
        return;
    }
    if (t > 0) {
        TK(t <= 10);
        if (entersLowZone(p, t) && !state.rx) {
            talkClock.alerts++;
            lowAlert();
        }
        if (t <= LOW_SECONDS) {
            vibrate(heartbeat(t, state.rx));
        }
    }
    talkClock.pings++;
    talkClock.say = announcement(p, t) || talkClock.say;
    if (t <= 0) {
        TKE();
        vibrate([200, 100, 200]);
    }
}

/** "+1 min"; after the time ran out it starts a fresh minute instead. */
export function addMinute() {
    if (talkClock.t <= 0) {
        total = 60;
        talkClock.t = 60;
        talkClock.say = "Timer repornit: 1 minut";
        talkClock.paused = false;
        end = Date.now() + 60000;
        talkClock.talkEnd = end;
        talkClock.talkRem = 0;
        stopTalkTimer();
        id = setInterval(run, 250);
    }
    else {
        total += 60;
        talkClock.t += 60;
        talkClock.say = `S-a adăugat un minut. Mai sunt ${spokenTime(talkClock.t)}`;
        if (talkClock.paused) {
            rem += 60000;
            talkClock.talkRem = rem;
        }
        else {
            end += 60000;
            talkClock.talkEnd = end;
        }
    }
    paintRing();
}
