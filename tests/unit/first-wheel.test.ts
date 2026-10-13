// @vitest-environment jsdom
/**
 * The opening wheel hands over to the "Începe ..." line through ONE path: a spin that runs to the end and "Sari peste" both
 * play the stop cue, wait WHEEL_SETTLE_MS and only then call `ondone` (which announces who starts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { installShell } from "./helpers/screen.ts";

const sounds = vi.hoisted(() => ({ wheelTick: vi.fn(), wheelStop: vi.fn() }));
vi.mock("#lib/audio/drama-sounds.ts", () => sounds);
vi.mock("#lib/audio/haptics.ts", () => ({ vibrate: vi.fn() }));

let app: ReturnType<typeof mount> | undefined;
const ondone = vi.fn();

beforeEach(async () => {
  installShell(); // fake timers, matchMedia stub, #app / #sr
  sounds.wheelStop.mockClear();
  ondone.mockClear();
  const { state } = await import("#lib/stores/settings.svelte.ts");
  state.players = [0, 1, 2, 3].map((a) => ({ n: "", a }));
});
afterEach(() => {
  if (app) unmount(app);
  app = undefined;
  vi.useRealTimers();
});

/** A disc whose Web Animation never finishes on its own, like a spin that is still running. */
function runningAnimation() {
  const anim = { onfinish: null as null | (() => void), cancel: vi.fn() };
  Element.prototype.animate = vi.fn(() => anim) as unknown as typeof Element.prototype.animate;
  return anim;
}

async function mountWheel() {
  const { default: FirstWheel } = await import("#lib/components/game/FirstWheel.svelte");
  app = mount(FirstWheel, { target: document.getElementById("app")!, props: { first: 2, ondone } });
  flushSync();
}

describe("FirstWheel handoff", () => {
  it("\"Sari peste\" does not announce right away: it lands the disc, plays the stop cue and waits the settle pause", async () => {
    runningAnimation();
    const { WHEEL_SETTLE_MS } = await import("#lib/game/wheel.ts");
    await mountWheel();
    const skip = document.querySelector<HTMLButtonElement>(".wskip")!;
    skip.click();
    flushSync();

    expect(ondone).not.toHaveBeenCalled();
    expect(sounds.wheelStop).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLElement>(".wheel")!.style.transform).toMatch(/^rotate\(/);
    expect(skip.disabled).toBe(true);

    vi.advanceTimersByTime(WHEEL_SETTLE_MS - 1);
    expect(ondone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(ondone).toHaveBeenCalledTimes(1);
  });

  it("a spin that runs to the end uses the same pause, and a second tap on skip does nothing", async () => {
    const anim = runningAnimation();
    const { WHEEL_SETTLE_MS } = await import("#lib/game/wheel.ts");
    await mountWheel();
    anim.onfinish?.();
    document.querySelector<HTMLButtonElement>(".wskip")!.click();
    anim.onfinish?.();

    expect(sounds.wheelStop).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(WHEEL_SETTLE_MS);
    expect(ondone).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(ondone).toHaveBeenCalledTimes(1);
  });

  it("leaving the screen during the pause cancels the announcement", async () => {
    runningAnimation();
    await mountWheel();
    document.querySelector<HTMLButtonElement>(".wskip")!.click();
    unmount(app!);
    app = undefined;
    vi.advanceTimersByTime(5000);
    expect(ondone).not.toHaveBeenCalled();
  });
});
