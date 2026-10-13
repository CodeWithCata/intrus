// @vitest-environment jsdom
/** Mobile behaviour: the screen stays on during a round, saved data is protected from eviction, audio recovers, and the early theme script matches the real storage key. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { installShell } from "./helpers/screen.ts";
import { STORAGE_KEY } from "#lib/storage/keys.ts";

let nav: any, wake: any, persist: any;
beforeAll(async () => {
  installShell();
  nav = await import("#lib/stores/nav.svelte.ts");
  wake = await import("#lib/utils/wake-lock.svelte.ts");
  persist = await import("#lib/storage/persist.svelte.ts");
});

describe("wake lock", () => {
  it("is wanted on every round screen and on the online round, never on setup or intro", () => {
    for (const s of ["pass", "talk", "vote", "tally", "reveal", "troll", "online"]) {
      expect(wake.needsAwake(s), s).toBe(true);
    }
    for (const s of ["setup", "intro", "scoreboard", null]) {
      expect(wake.needsAwake(s), String(s)).toBe(false);
    }
  });

  it("holds the lock during a round and gives it back when the round ends", async () => {
    const release = vi.fn(() => Promise.resolve());
    const sentinel = { release, addEventListener: vi.fn() };
    const request = vi.fn(() => Promise.resolve(sentinel));
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });

    wake.initWakeLock();
    nav.nav.screen = "setup";
    await vi.waitFor(() => expect(request).not.toHaveBeenCalled());

    nav.nav.screen = "talk";
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith("screen"));

    nav.nav.screen = "scoreboard";
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    delete (navigator as any).wakeLock;
  });

  it("does nothing, and does not throw, where the API is missing", () => {
    expect("wakeLock" in navigator).toBe(false);
    expect(() => wake.initWakeLock()).not.toThrow();
  });
});

describe("durable storage", () => {
  afterEach(() => delete (navigator as any).storage);

  it("asks the browser to persist, once", async () => {
    const persistFn = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(navigator, "storage", { value: { persisted: () => Promise.resolve(false), persist: persistFn }, configurable: true });
    expect(await persist.requestDurableStorage()).toBe(true);
    expect(persistFn).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when storage is already persistent", async () => {
    const persistFn = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(navigator, "storage", { value: { persisted: () => Promise.resolve(true), persist: persistFn }, configurable: true });
    expect(await persist.requestDurableStorage()).toBe(true);
    expect(persistFn).not.toHaveBeenCalled();
  });

  it("returns false without the API or when it throws", async () => {
    expect(await persist.requestDurableStorage()).toBe(false);
    Object.defineProperty(navigator, "storage", { value: { persisted: () => Promise.reject(new Error("no")), persist: vi.fn() }, configurable: true });
    expect(await persist.requestDurableStorage()).toBe(false);
  });
});

describe("early theme script (src/app.html)", () => {
  const html = readFileSync("src/app.html", "utf8");

  it("reads the same storage key as the app", () => {
    expect(html).toContain(`localStorage.getItem("${STORAGE_KEY}")`);
  });

  it("is a plain inline script that sets the theme from saved data and ignores a bad accent", () => {
    const code = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
    const run = (saved: unknown) => {
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.style.removeProperty("--red");
      document.head.innerHTML = '<meta name="theme-color" content="#FFFFFF">';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      new Function(code)();
      return { theme: document.documentElement.dataset.theme, red: document.documentElement.style.getPropertyValue("--red"), meta: document.querySelector('meta[name="theme-color"]')!.getAttribute("content") };
    };
    expect(run({ theme: "dark", acc: "#00AA55" })).toEqual({ theme: "dark", red: "#00AA55", meta: "#0F0F13" });
    expect(run({ theme: "noir" }).meta).toBe("#000000");
    expect(run({ theme: "light" })).toEqual({ theme: undefined, red: "", meta: "#FFFFFF" });
    expect(run({ theme: "dark", acc: "red;}body{display:none" }).red).toBe("");
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => new Function(code)()).not.toThrow();
  });
});

describe("fonts", () => {
  it("are WOFF2 and every referenced file exists", () => {
    const css = readFileSync("src/lib/styles/fonts.css", "utf8");
    const files = [...css.matchAll(/url\("\.\.\/assets\/fonts\/([^"]+)"\)/g)].map(m => m[1]);
    expect(files.length).toBe(4);
    for (const f of files) {
      expect(f.endsWith(".woff2")).toBe(true);
      expect(readFileSync(`src/lib/assets/fonts/${f}`).subarray(0, 4).toString()).toBe("wOF2");
    }
    expect(css).not.toMatch(/format\("woff"\)/);
  });
});
