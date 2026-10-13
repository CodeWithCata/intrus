// @vitest-environment jsdom
/**
 * Online round, built from the local components: the timer store follows the server, the wheel waits for the shared start time,
 * and OnlineScreen shows the right stage (and never the word before the host reveals).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { installShell } from "./helpers/screen.ts";

const sounds = vi.hoisted(() => ({ TK: vi.fn(), TKE: vi.fn(), wheelTick: vi.fn(), wheelStop: vi.fn(), lowAlert: vi.fn() }));
vi.mock("#lib/audio/tick-styles.ts", () => ({ TK: sounds.TK, TKE: sounds.TKE }));
vi.mock("#lib/audio/drama-sounds.ts", () => ({ wheelTick: sounds.wheelTick, wheelStop: sounds.wheelStop, lowAlert: sounds.lowAlert, dramaRoll: vi.fn(), dramaFake: vi.fn(), dramaFlip: vi.fn(), dramaHit: vi.fn() }));
vi.mock("#lib/audio/haptics.ts", () => ({ vibrate: vi.fn() }));

let app: ReturnType<typeof mount> | undefined;
beforeEach(() => {
  installShell();
  Object.values(sounds).forEach((f) => f.mockClear());
});
afterEach(() => {
  if (app) unmount(app);
  app = undefined;
  vi.useRealTimers();
});

describe("syncTalkClock (the server's timer drives the same ring as the local one)", () => {
  it("shows the time left, keeps the ring fraction against the longest time seen, and resets on null", async () => {
    const { syncTalkClock, talkClock } = await import("#lib/stores/talk.svelte.ts");
    syncTalkClock(null, false);
    syncTalkClock(60_000, false);
    expect(talkClock).toMatchObject({ t: 60, frac: 1, paused: false });
    syncTalkClock(30_000, false);
    expect(talkClock.t).toBe(30);
    expect(talkClock.frac).toBeCloseTo(0.5, 5);
    expect(talkClock.pings).toBeGreaterThan(0);
    syncTalkClock(90_000, false); // "+1 min": the ring is measured against the new, longer time
    expect(talkClock.frac).toBeCloseTo(1, 5);
    syncTalkClock(45_000, true);
    expect(talkClock.paused).toBe(true);
    syncTalkClock(null, false);
    expect(talkClock).toMatchObject({ t: 0, paused: false, alerts: 0 });
  });

  it("ticks, flashes the alert when the last seconds begin, and plays the end cue at zero", async () => {
    const { syncTalkClock, talkClock } = await import("#lib/stores/talk.svelte.ts");
    syncTalkClock(null, false);
    syncTalkClock(12_000, false);
    expect(sounds.TK).not.toHaveBeenCalled(); // the first reading is not a tick
    syncTalkClock(9_500, false);
    expect(sounds.TK).toHaveBeenCalled();
    expect(talkClock.alerts).toBeGreaterThan(0);
    syncTalkClock(1_000, false);
    syncTalkClock(0, false);
    expect(sounds.TKE).toHaveBeenCalledTimes(1);
  });
});

describe("FirstWheel with a shared start time", () => {
  function fakeAnimation() {
    const anim = { onfinish: null as null | (() => void), cancel: vi.fn(), currentTime: 0 as number | null };
    Element.prototype.animate = vi.fn(() => anim) as unknown as typeof Element.prototype.animate;
    return anim;
  }
  async function mountWheel(startAt: number | undefined) {
    const { state } = await import("#lib/stores/settings.svelte.ts");
    state.players = [0, 1, 2, 3].map((a) => ({ n: "", a })); // the LOCAL players must not matter when `players` is given
    const { default: FirstWheel } = await import("#lib/components/game/FirstWheel.svelte");
    const ondone = vi.fn();
    app = mount(FirstWheel, { target: document.getElementById("app")!, props: { first: 1, players: [{ a: 0, l: 5 }, { a: 0, l: 9 }, { a: 0, l: 11 }], startAt, ondone } });
    flushSync();
    return ondone;
  }

  it("draws the given players and waits for the start time before it turns", async () => {
    fakeAnimation();
    await mountWheel(Date.now() + 1500);
    expect(document.querySelectorAll(".wslice")).toHaveLength(3);
    expect(Element.prototype.animate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1499);
    expect(Element.prototype.animate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(Element.prototype.animate).toHaveBeenCalledTimes(1);
  });

  it("a phone that is a little late joins the spin where it is", async () => {
    const anim = fakeAnimation();
    await mountWheel(Date.now() - 1000);
    expect(Element.prototype.animate).toHaveBeenCalledTimes(1);
    expect(anim.currentTime).toBeGreaterThanOrEqual(1000);
  });

  it("a phone that is later than the whole spin goes straight to the stop", async () => {
    fakeAnimation();
    const { WHEEL_MS, WHEEL_SETTLE_MS } = await import("#lib/game/wheel.ts");
    const ondone = await mountWheel(Date.now() - WHEEL_MS - 10);
    expect(Element.prototype.animate).not.toHaveBeenCalled();
    expect(sounds.wheelStop).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(WHEEL_SETTLE_MS);
    expect(ondone).toHaveBeenCalledTimes(1);
  });
});

describe("OnlineScreen stages", () => {
  const players = [
    { id: "me", name: "Ana", l: 0, score: 0, connected: true },
    { id: "b", name: "Bob", l: 4097, score: 1, connected: true },
    { id: "c", name: "Cara", l: 2, score: 2, connected: true }
  ];
  const base = { code: "ABCDEF", hostId: "me", phase: "round" as const, round: 1, settings: null, timer: null, players, vote: null, seen: [] as string[], dealt: null, talk: null, twist: null, question: null, reveal: null };

  async function show(state: Record<string, unknown>, role: unknown = { isIntruder: false, word: "SECRETWORD", category: "Food", decoy: null, hint: "category", letter: null, mates: [] as string[], customHint: null }) {
    const { online } = await import("#lib/online/client.svelte.ts");
    Object.assign(online, { status: "in", code: "ABCDEF", playerId: "me", state, role, stateAt: Date.now() });
    const { default: OnlineScreen } = await import("#lib/views/OnlineScreen.svelte");
    app = mount(OnlineScreen, { target: document.getElementById("app")! });
    flushSync();
    return online;
  }

  it("card stage: the local Card, who has seen theirs, and the host's start button", async () => {
    await show({ ...base, seen: ["b"] });
    expect(document.querySelector(".card")).not.toBeNull();
    expect(document.querySelector(".statusrow")).not.toBeNull();
    // the card face is only built while it is held open: the word is not in the page yet
    expect(document.body.textContent).not.toContain("SECRETWORD");
    const go = document.querySelector(".dock .btn.go") as HTMLButtonElement;
    expect(go.disabled).toBe(true); // the host has not looked at their own card yet
  });

  it("the vote stage shows the local suspect buttons for the OTHERS, with a lens and an avatar, and who has voted", async () => {
    await show({ ...base, talk: { starterId: "b", sinceMs: 99999 }, vote: { revealed: false, voted: ["b"], picks: null, tally: null } });
    const buttons = [...(document.querySelectorAll(".suspect") as NodeListOf<HTMLButtonElement>)];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(["Bob", "Cara"]);
    expect(buttons[0].querySelector(".lens")).not.toBeNull();
    expect(buttons[0].querySelector("svg.av")).not.toBeNull();
    expect(document.querySelectorAll(".statusrow .sp.done")).toHaveLength(1);
  });

  it("nothing about the word or the intruders is on screen until the host reveals", async () => {
    await show({ ...base, talk: { starterId: "b", sinceMs: 99999 }, vote: { revealed: true, voted: ["me", "b", "c"], picks: { me: "b", b: "c", c: "b" }, tally: { b: 2, c: 1 } } });
    expect(document.querySelector(".wordtag")).toBeNull();
    expect(document.querySelector(".stage")).toBeNull();
    expect(document.body.textContent).not.toContain("SECRETWORD");
    expect(document.querySelectorAll(".score")).toHaveLength(3);
    expect(document.querySelector(".score.top .name")?.textContent).toBe("Bob");
  });

  it("the reveal stage shows the intruder on the cone, the word, the verdict and (host) the outcome buttons", async () => {
    await show(
      { ...base, vote: { revealed: true, voted: ["me", "b", "c"], picks: {}, tally: { b: 3 } }, reveal: { intruderIds: ["b"], word: "SECRETWORD", twin: null } },
      null
    );
    expect(document.querySelector(".wordtag")?.textContent).toBe("SECRETWORD");
    expect(document.querySelector(".stage .h2")?.textContent).toBe("Bob");
    expect(document.querySelector(".verdict")).not.toBeNull();
    expect(document.querySelectorAll(".outcome")).toHaveLength(3);
    expect(document.querySelector(".outcome.rec")).not.toBeNull();
  });

  it("the scoreboard shows the trophy, a crown for first place and +N for everybody", async () => {
    const { startScores } = await import("#lib/online/client.svelte.ts");
    startScores.scores = { me: 0, b: 0, c: 1 };
    await show({ ...base, phase: "scores", players: [players[0], { ...players[1], score: 1 }, { ...players[2], score: 2 }] }, null);
    expect(document.querySelector("svg.trophy")).not.toBeNull();
    const rows = [...document.querySelectorAll(".score")];
    expect(rows[0].classList.contains("top")).toBe(true);
    expect(rows[0].querySelector(".name")?.textContent).toContain("Cara");
    expect(rows[0].querySelector(".name .muted")?.textContent).toContain("+1");
    expect(rows[1].querySelector(".name .muted")?.textContent).toContain("+1");
  });
});
