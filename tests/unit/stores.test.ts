// @vitest-environment jsdom
/** The reactive stores: `round` is replaced in place, and ONE effect persists `state` under the unchanged keys. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installShell } from "./helpers/screen.ts";
import { STORAGE_KEY } from "#lib/storage/keys.ts";

let state: any, ui: any, persist: any;
beforeAll(async () => {
  installShell();
  ({ state } = await import("#lib/stores/settings.svelte.ts"));
  ui = await import("#lib/stores/ui.svelte.ts");
  persist = await import("#lib/storage/persist.svelte.ts");
});

describe("round", () => {
  it("resetRound() replaces the contents but keeps the same reactive object", () => {
    const ref = ui.round;
    ui.resetRound({ word: "A", cat: "X", intr: [0], troll: false, first: 0, votes: [], hint: "", tw: "dbl", da: 1 });
    expect(ui.round.da).toBe(1);
    ui.resetRound({ word: "B", cat: "Y", intr: [2], troll: true, first: 1, votes: [], hint: "", tw: null });
    expect(ui.round).toBe(ref);
    expect(ui.round.word).toBe("B");
    expect("da" in ui.round).toBe(false); // nothing leaks from the previous round
  });
});

describe("autosave", () => {
  // The names players already have in their browsers. Adding or renaming one needs a migration.
  const SAVED_KEYS = ["players", "k", "cats", "tm", "hint", "custom", "cu", "troll", "snd", "vb", "lite", "liteSet", "theme", "acc", "rv", "rs", "rsv", "rb", "cd", "tk", "rounds", "hist", "rn", "seen", "vol", "scores", "last", "groups", "gid", "rc", "sr", "tw", "qm", "vh", "wl0", "dr", "pv", "vm", "twn", "kn", "rx", "pty", "gt", "wh", "cv"];

  it("saves once, 300 ms after the last change, under the unchanged key names", async () => {
    persist.startAutosave();
    await vi.advanceTimersByTimeAsync(400); // the initial run
    localStorage.removeItem(STORAGE_KEY);

    state.k = 2;
    state.theme = "dark";
    state.players[0].n = "Ana";
    await vi.advanceTimersByTimeAsync(100);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull(); // debounced

    state.cats = state.cats.slice(0, 2); // another change restarts the 300 ms
    await vi.advanceTimersByTimeAsync(250);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await vi.advanceTimersByTimeAsync(100);

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved).toMatchObject({ k: 2, theme: "dark" });
    expect(saved.players[0].n).toBe("Ana");
    expect(saved.cats).toHaveLength(2);
    expect(Object.keys(saved).sort()).toEqual(SAVED_KEYS.filter((k) => saved[k] !== undefined).sort());
  });

  it("does not write for state that is never persisted (sheet, form fields)", async () => {
    await vi.advanceTimersByTimeAsync(400);
    localStorage.removeItem(STORAGE_KEY);
    state.sheet = "cats";
    state.nw = "cuvânt";
    await vi.advanceTimersByTimeAsync(1000);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("saveStateNow() writes immediately", () => {
    localStorage.removeItem(STORAGE_KEY);
    persist.saveStateNow();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).k).toBe(2);
  });
});
