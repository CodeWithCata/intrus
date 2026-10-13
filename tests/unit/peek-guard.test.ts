// @vitest-environment jsdom
/** The privacy guard of the pass card: tilt / shake maths, the permission answer, and which events close the card. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHAKE_DELTA, TILT_LIMIT, guardPeek, isShake, requestMotion, resetMotionPermission, tiltedAway } from "#lib/components/game/peek-guard.ts";

afterEach(() => {
  resetMotionPermission();
  vi.unstubAllGlobals();
});

const orient = (beta: number, gamma: number) => Object.assign(new Event("deviceorientation"), { beta, gamma });

describe("tilt and shake", () => {
  it("tilting away more than the limit hides, small movements do not", () => {
    const base = { beta: 40, gamma: 0 };
    expect(tiltedAway(45, 5, base)).toBe(false);
    expect(tiltedAway(40 + TILT_LIMIT + 1, 0, base)).toBe(true);
    expect(tiltedAway(40, -TILT_LIMIT - 1, base)).toBe(true);
    expect(tiltedAway(-179, 0, { beta: 179, gamma: 0 })).toBe(false); // the -180/180 wrap is a 2 degree move
  });
  it("a shake is a jolt far from gravity; resting and missing sensors are not", () => {
    expect(isShake({ x: 0, y: 0, z: 9.81 })).toBe(false);
    expect(isShake({ x: 0, y: 0, z: 9.81 + SHAKE_DELTA + 1 })).toBe(true);
    expect(isShake({ x: null, y: null, z: null })).toBe(false);
  });
});

describe("requestMotion", () => {
  it("no sensors at all: unavailable (the card stays hold-only)", async () => {
    vi.stubGlobal("DeviceMotionEvent", undefined);
    expect(await requestMotion()).toBe("unavailable");
  });
  it("iOS style: asks once and remembers a refusal", async () => {
    const ask = vi.fn(async () => "denied");
    vi.stubGlobal("DeviceMotionEvent", { requestPermission: ask });
    expect(await requestMotion()).toBe("denied");
    expect(await requestMotion()).toBe("denied");
    expect(ask).toHaveBeenCalledTimes(1);
  });
  it("other browsers need no prompt", async () => {
    vi.stubGlobal("DeviceMotionEvent", class {});
    expect(await requestMotion()).toBe("granted");
  });
});

describe("guardPeek", () => {
  it("hides on page hidden, blur, pagehide and rotation, and stops after detaching", () => {
    const hide = vi.fn();
    const stop = guardPeek(hide);
    for (const type of ["blur", "pagehide", "orientationchange"]) window.dispatchEvent(new Event(type));
    expect(hide).toHaveBeenCalledTimes(3);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(hide).toHaveBeenCalledTimes(4);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    stop();
    window.dispatchEvent(new Event("blur"));
    expect(hide).toHaveBeenCalledTimes(4);
  });
  it("with motion allowed, a big tilt after the first reading hides; before permission it is ignored", async () => {
    const hide = vi.fn();
    guardPeek(hide)();
    vi.stubGlobal("DeviceMotionEvent", class {});
    await requestMotion();
    const h2 = vi.fn();
    const stop = guardPeek(h2);
    window.dispatchEvent(orient(40, 0)); // the baseline: how the phone is held
    window.dispatchEvent(orient(45, 3));
    expect(h2).toHaveBeenCalledTimes(0);
    window.dispatchEvent(orient(100, 0));
    expect(h2).toHaveBeenCalledTimes(1);
    stop();
  });
  it("without permission the sensors are not listened to", () => {
    const hide = vi.fn();
    const stop = guardPeek(hide);
    window.dispatchEvent(orient(0, 0));
    window.dispatchEvent(orient(170, 80));
    expect(hide).toHaveBeenCalledTimes(0);
    stop();
  });
});
