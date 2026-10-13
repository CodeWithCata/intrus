// @vitest-environment jsdom
/**
 * Golden test for the setup (home) screen. The snapshots in tests/golden/ were captured from the
 * original HTML-string implementation; the Svelte version must render the identical DOM.
 * Delete a snapshot (or run with UPDATE_GOLDEN=1) only when the design is changed on purpose.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { flushSync, mount } from "svelte";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { serialize } from "./helpers/dom.ts";
import { installShell, plain } from "./helpers/screen.ts";

const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=";
const player = (n: string, a: number, extra: any = {}) => ({ n, a, ...extra });

let mods: any;
beforeAll(async () => {
  installShell();
  const [settings, nav, App] = await Promise.all([
    import("#lib/stores/settings.svelte.ts"),
    import("#lib/stores/nav.svelte.ts"),
    import("#lib/App.svelte")
  ]);
  // go() changes the state; flushSync() lets App.svelte render the screen (and run its after-render effect).
  const setup = () => {
    nav.go("setup");
    flushSync();
  };
  mods = { ...settings, setup, base: plain(settings.state) };
  settings.initAppEl();
  mount(App.default, { target: document.querySelector("#app")! });
});

const scenarios: Record<string, (s: any) => void> = {
  default: () => {},
  "rich-group-rematch-custom": (s) => {
    const pl = [player("Ana", 0), player("Bogdan <b>&\"x\"", 1), player("", 2), player("Dan", 3, { ph: PHOTO }), player("Eli", 4), player("Fane", 5)];
    s.players = pl; s.k = 2; s.tm = 0; s.cats = s.cats.slice(0, 3);
    s.custom = "pisică, câine,  , papagal"; s.cu = true; s.lite = false;
    s.groups = [{ id: "g1", nm: "Gașca <3 & \"co\"", pl: pl.slice(0, 4), st: { r: 3, s: 0, t: 0, p: {} } }];
    s.gid = "g1";
    s.rc = { gid: "g1", pl: pl.slice(0, 5) };
  },
  "two-groups-no-current-lite": (s) => {
    s.players = [player("Ioana", 6), player("Mihai", 7), player("Vlad", 8), player("Zoe", 9), player("Radu", 10)];
    s.k = 1; s.tm = 7; s.lite = true;
    s.groups = [
      { id: "a", nm: "A", pl: s.players.slice(0, 3), st: { r: 1, s: 0, t: 0, p: {} } },
      { id: "b", nm: "B", pl: s.players.slice(0, 3), st: { r: 0, s: 0, t: 0, p: {} } }
    ];
    s.gid = null;
    s.rc = { gid: null, pl: s.players.slice(0, 4) };
  },
  "one-group-singular-no-rematch": (s) => {
    s.players = [player("", 0), player("", 1), player("", 2), player("", 3)];
    s.k = 1; s.tm = 1; s.lite = false; s.custom = "";
    s.groups = [{ id: "solo", nm: "Singurul", pl: s.players, st: { r: 0, s: 0, t: 0, p: {} } }];
    s.gid = null; s.rc = null;
  }
};

describe("setup screen golden DOM", () => {
  for (const [name, apply] of Object.entries(scenarios)) {
    it(name, () => {
      const { state, setup, base } = mods;
      Object.assign(state, structuredClone(base));
      apply(state);
      setup();
      const app = document.getElementById("app")!;
      const dump =
        `body.class=${JSON.stringify(document.body.className)} html.class=${JSON.stringify(document.documentElement.className)}\n` +
        `sheet-root=${JSON.stringify(document.getElementById("sr")!.innerHTML.replace(/<!--.*?-->/g, ""))}\n` +
        serialize(app);
      if (process.env.ACTUAL_DIR) writeFileSync(`${process.env.ACTUAL_DIR}/setup.${name}.html`, dump);
      const file = `tests/golden/setup.${name}.html`;
      if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
        writeFileSync(file, dump);
        return;
      }
      expect(dump).toBe(readFileSync(file, "utf8"));
    });
  }
});
