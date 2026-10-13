// @vitest-environment jsdom
/** The discussion countdown store: ticking, pausing, "+1 min" and expiry, without any DOM. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sounds = vi.hoisted(() => ({ TK: vi.fn(), TKE: vi.fn() }));
vi.mock("#lib/audio/tick-styles.ts", () => sounds);
vi.mock("#lib/audio/haptics.ts", () => ({ vibrate: vi.fn() }));
const drama = vi.hoisted(() => ({ lowAlert: vi.fn() }));
vi.mock("#lib/audio/drama-sounds.ts", () => drama);

let t: any;
beforeEach(async () => {
  vi.useFakeTimers();
  // settings.svelte.ts reads matchMedia when it is imported, and jsdom has none
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  drama.lowAlert.mockClear();
  sounds.TK.mockClear();
  sounds.TKE.mockClear();
  t = await import("#lib/stores/talk.svelte.ts");
  t.stopTalkTimer();
});

describe("talk timer store", () => {
  it("counts down once per second and drives the ring", () => {
    t.startTalkTimer(10);
    expect(t.talkClock).toMatchObject({ t: 10, frac: 1, paused: false, pings: 0 });
    vi.advanceTimersByTime(3000);
    expect(t.talkClock.t).toBe(7);
    expect(t.talkClock.frac).toBeCloseTo(0.7, 1);
    expect(t.talkClock.pings).toBeGreaterThan(0);
    expect(sounds.TK).toHaveBeenCalled();
  });

  it("pausing freezes the clock and resuming continues from where it stopped", () => {
    t.startTalkTimer(10);
    vi.advanceTimersByTime(3000);
    t.togglePause();
    expect(t.talkClock.paused).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(t.talkClock.t).toBe(7);
    t.togglePause();
    expect(t.talkClock.paused).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(t.talkClock.t).toBe(5);
  });

  it("'+1 min' extends a running (or paused) countdown", () => {
    t.startTalkTimer(10);
    vi.advanceTimersByTime(5000);
    t.addMinute();
    expect(t.talkClock.t).toBe(65);
    t.togglePause();
    t.addMinute();
    expect(t.talkClock.t).toBe(125);
    t.togglePause();
    vi.advanceTimersByTime(1000);
    expect(t.talkClock.t).toBe(124);
  });

  it("stops at zero, plays the end sound, and '+1 min' then starts a fresh minute", () => {
    t.startTalkTimer(2);
    vi.advanceTimersByTime(2500);
    expect(t.talkClock.t).toBe(0);
    expect(t.talkClock.frac).toBe(0);
    expect(sounds.TKE).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(sounds.TKE).toHaveBeenCalledTimes(1); // the interval is gone

    t.togglePause(); // nothing to pause once it ran out
    expect(t.talkClock.paused).toBe(false);

    t.addMinute();
    expect(t.talkClock.t).toBe(60);
    vi.advanceTimersByTime(1000);
    expect(t.talkClock.t).toBe(59);
  });

  it("stopTalkTimer() halts the countdown", () => {
    t.startTalkTimer(10);
    vi.advanceTimersByTime(1000);
    t.stopTalkTimer();
    vi.advanceTimersByTime(5000);
    expect(t.talkClock.t).toBe(9);
  });
});

describe("last seconds cue", () => {
  it("fires once, on the tick where the dimming starts, and not again inside the zone", () => {
    t.startTalkTimer(14);
    expect(t.talkClock.alerts).toBe(0);
    vi.advanceTimersByTime(3000); // 14 -> 11: still above the zone
    expect(drama.lowAlert).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); // 10 left: the dimming starts
    expect(drama.lowAlert).toHaveBeenCalledTimes(1);
    expect(t.talkClock.alerts).toBe(1);
    vi.advanceTimersByTime(6000);
    expect(drama.lowAlert).toHaveBeenCalledTimes(1);
  });

  it("fires again after '+1 min' lifts the clock out of the zone and it falls back in", () => {
    t.startTalkTimer(12);
    vi.advanceTimersByTime(2000);
    expect(t.talkClock.alerts).toBe(1);
    t.addMinute(); // 70 s
    vi.advanceTimersByTime(61000); // back down to 9 s
    expect(t.talkClock.alerts).toBe(2);
  });

  it("does not fire for a timer that starts inside the zone, and starting a timer resets the counter", () => {
    t.startTalkTimer(8);
    vi.advanceTimersByTime(3000);
    expect(drama.lowAlert).not.toHaveBeenCalled();
    t.startTalkTimer(12);
    vi.advanceTimersByTime(2000);
    t.startTalkTimer(30);
    expect(t.talkClock.alerts).toBe(0);
  });

  it("stays silent in relaxed mode", async () => {
    const { state } = await import("#lib/stores/settings.svelte.ts");
    state.rx = true;
    t.startTalkTimer(12);
    vi.advanceTimersByTime(3000);
    state.rx = false;
    expect(drama.lowAlert).not.toHaveBeenCalled();
    expect(t.talkClock.alerts).toBe(0);
  });
});

describe("screen-reader announcements", () => {
  it("speaks only at whole minutes, 30 s, 10 s and when time is up", () => {
    const said = [];
    for (let from = 181; from > 0; from--) {
      const m = t.announcement(from, from - 1);
      if (m) said.push(m);
    }
    expect(said).toEqual(["Mai sunt 3 minute", "Mai sunt 2 minute", "Mai sunt 1 minut", "Mai sunt 30 de secunde", "Mai sunt 10 secunde", "Timpul a expirat"]);
  });

  it("does not miss a mark when the tab was throttled and several seconds passed", () => {
    expect(t.announcement(65, 58)).toBe("Mai sunt 1 minut");
  });

  it("announces the start, pause and resume", () => {
    t.startTalkTimer(120);
    expect(t.talkClock.say).toBe("");
    vi.advanceTimersByTime(900);
    expect(t.talkClock.say).toBe("Timp de discuție: 2 minute");
    t.togglePause();
    expect(t.talkClock.say).toBe("Timer oprit");
    t.togglePause();
    expect(t.talkClock.say).toMatch(/^Timer reluat/);
  });
});

