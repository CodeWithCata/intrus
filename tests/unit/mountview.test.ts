// @vitest-environment jsdom
/** The contract every Svelte screen relies on: App.svelte shows exactly one screen, go() replaces it and focuses its heading. */
import { beforeAll, describe, expect, it } from "vitest";
import { flushSync, mount } from "svelte";
import { installShell } from "./helpers/screen.ts";

let nav: any, ui: any, settings: any;
beforeAll(async () => {
  installShell();
  settings = await import("#lib/stores/settings.svelte.ts");
  ui = await import("#lib/stores/ui.svelte.ts");
  nav = await import("#lib/stores/nav.svelte.ts");
  const App = (await import("#lib/App.svelte")).default;
  settings.initAppEl();
  mount(App, { target: document.querySelector("#app")! });
  settings.state.gt = false; // no hand-over gate: the card step opens at once
  settings.state.players = [{ n: "Ana", a: 0 }, { n: "Dan", a: 1 }, { n: "Eli", a: 2 }];
  ui.resetRound({ word: "Farmacie", cat: "Locuri", intr: [1], troll: false, first: 0, votes: [], hint: "", tw: null });
});

describe("go / App", () => {
  it("renders one screen at a time, replaces it on every go() and focuses the heading", () => {
    nav.go("pass", { i: 0 });
    flushSync();
    expect(document.querySelectorAll(".who h1")).toHaveLength(1);
    expect(document.querySelector(".who h1")!.textContent).toBe("Ana");
    expect(document.activeElement).toBe(document.querySelector("h1"));
    expect(nav.nav).toMatchObject({ screen: "pass", props: { i: 0 } });

    nav.go("pass", { i: 1 }); // same screen, new props
    flushSync();
    expect(document.querySelectorAll(".who h1")).toHaveLength(1);
    expect(document.querySelector(".who h1")!.textContent).toBe("Dan");

    nav.go("vote", { i: 0 }); // another screen
    flushSync();
    expect(document.querySelector("#card")).toBeNull();
    expect(document.querySelectorAll(".suspect").length).toBeGreaterThan(0);
  });
});
