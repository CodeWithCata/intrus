// @vitest-environment jsdom
/** The update flow: a new build is looked for when the app returns to the foreground and offered to the player (never applied behind their back). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyUpdate, initUpdates } from "#lib/utils/sw-update.ts";

type Listener = () => void;
let controllerListeners: Listener[];
let reg: any;

function fakeServiceWorker(hasController: boolean) {
  controllerListeners = [];
  reg = { update: vi.fn(() => Promise.resolve()), waiting: null, addEventListener: vi.fn() };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      controller: hasController ? {} : null,
      addEventListener: (_t: string, fn: Listener) => controllerListeners.push(fn),
      getRegistration: () => Promise.resolve(reg)
    }
  });
}

const foreground = async () => {
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
};

// initUpdates() listens on the shared document: remove what each test added so the tests cannot hear each other.
let added: [string, EventListener][] = [];
beforeEach(() => {
  vi.useFakeTimers();
  added = [];
  const real = document.addEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation((type: string, fn: any, o?: any) => {
    added.push([type, fn]);
    real(type, fn, o);
  });
});
afterEach(() => {
  added.forEach(([t, f]) => document.removeEventListener(t, f));
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (navigator as any).serviceWorker;
});

describe("service worker updates", () => {
  it("does not reload for the very first install (the worker claims a page that had none)", () => {
    fakeServiceWorker(false);
    const reload = vi.fn();
    initUpdates(() => true, reload);
    controllerListeners.forEach(f => f());
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when a new worker takes over, but not while a round is in progress", () => {
    fakeServiceWorker(true);
    const reload = vi.fn();
    let rest = false;
    initUpdates(() => rest, reload);
    controllerListeners.forEach(f => f());
    expect(reload).not.toHaveBeenCalled();
    rest = true;
    controllerListeners.forEach(f => f());
    controllerListeners.forEach(f => f());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("looks for a new build on return to the foreground, at most every 10 minutes", async () => {
    fakeServiceWorker(true);
    initUpdates(() => true, vi.fn());
    await foreground();
    expect(reg.update).toHaveBeenCalledTimes(1);
    await foreground();
    expect(reg.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    await foreground();
    expect(reg.update).toHaveBeenCalledTimes(3); // the start-up check after 8 s, then this one
  });

  it("tells the app when a worker is waiting, and only takes over when the player taps Update", async () => {
    fakeServiceWorker(true);
    reg.waiting = { postMessage: vi.fn() };
    const onReady = vi.fn();
    const reload = vi.fn();
    initUpdates(() => false, reload, onReady);
    await foreground();
    expect(onReady).toHaveBeenCalled();
    expect(reg.waiting.postMessage).not.toHaveBeenCalled(); // nothing is applied by itself
    expect(applyUpdate()).toBe(true);
    expect(reg.waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    controllerListeners.forEach(f => f()); // the new worker took over: reload even though a round is "running"
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not offer an update on the very first install", async () => {
    fakeServiceWorker(false);
    reg.waiting = { postMessage: vi.fn() };
    const onReady = vi.fn();
    initUpdates(() => true, vi.fn(), onReady);
    await foreground();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("survives a failed update check (offline)", async () => {
    fakeServiceWorker(true);
    reg.update = vi.fn(() => Promise.reject(new TypeError("offline")));
    initUpdates(() => true, vi.fn());
    await expect(foreground()).resolves.toBeUndefined();
  });

  it("does nothing without service worker support", () => {
    expect(() => initUpdates(() => true, vi.fn())).not.toThrow();
  });
});
