// @vitest-environment jsdom
/**
 * Behaviour of the Svelte-mounted setup screen that a DOM snapshot cannot prove: the summaries
 * following the reactive `state` in place, remounting, and teardown after state changed while mounted.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { flushSync, mount } from "svelte";
import { installShell, plain } from "./helpers/screen.ts";

let m: any;
const $ = (sel: string) => document.querySelector(sel) as any;
const app = () => document.getElementById("app")!;

beforeAll(async () => {
  installShell();
  const [settings, nav, App] = await Promise.all([
    import("#lib/stores/settings.svelte.ts"),
    import("#lib/stores/nav.svelte.ts"),
    import("#lib/App.svelte")
  ]);
  const go = (screen: string) => {
    nav.go(screen as any);
    flushSync();
  };
  m = { ...settings, go, setup: () => go("setup"), base: plain(settings.state) };
  settings.initAppEl();
  mount(App.default, { target: document.querySelector("#app")! });
});

beforeEach(() => {
  Object.assign(m.state, structuredClone(m.base));
  m.setup();
});

describe("setup screen (Svelte)", () => {
  it("renders each summary from the state", () => {
    expect($("#pv").textContent).toBe("3 jucători");
    expect($("#pv").querySelectorAll(".avs > svg.av")).toHaveLength(3);
    expect($("#gv").textContent).toBe("Salvează echipa");
    expect($("#catval").querySelectorAll(".stk > span")).toHaveLength(3);
    expect($("#catval").textContent).toBe("Toate");
    expect($("#rv").textContent).toBe("1 intrus · 3 min");
    expect($("#sum").textContent).toBe("3 jucători1 intrus3 min");
    expect($("#ol0").textContent).toBe("Fiecare pe telefonul lui");
  });

  it("repaints the summaries in place when state changes, with no manual refresh", () => {
    const [pv, sum, card] = [$("#pv"), $("#sum"), $("#pv").closest("button")];
    m.state.players.push({ n: "Nou", a: 3 });
    m.state.k = 1;
    flushSync();
    expect($("#pv")).toBe(pv); // same node: Svelte patches the element, it is not replaced
    expect($("#sum")).toBe(sum);
    expect($("#pv").closest("button")).toBe(card);
    expect(pv.textContent).toContain("4 jucători");
    expect(sum.textContent).toContain("4");
    expect(pv.querySelectorAll(".avs > svg.av")).toHaveLength(4);
    expect(sum.querySelector(".chip2 b")!.textContent).toBe("4");
    expect(document.querySelectorAll(".page2 .sum")).toHaveLength(5);
  });

  it("follows edits made to a player or to the rules", () => {
    m.state.tm = 5;
    m.state.k = 1;
    flushSync();
    expect($("#rv").textContent).toBe("1 intrus · 5 min");
    m.state.tm = 0;
    flushSync();
    expect($("#rv").textContent).toBe("1 intrus · fără timer");
    expect($("#sum").textContent).toContain("fără timer");
  });

  it("opens the matching bottom sheet from each row", () => {
    const row = (title: string) => [...document.querySelectorAll(".page2 .sum")].find((e) => e.querySelector(".rname")?.textContent === title) as HTMLElement;
    for (const [title, sheet] of [["Jucători", "players"], ["Grupuri", "groups"], ["Categorii", "cats"], ["Reguli", "rules"], ["Joacă online", "online"]]) {
      m.state.sheet = null;
      row(title).click();
      expect(m.state.sheet).toBe(sheet);
      flushSync();
      expect(document.querySelector("#sr .scrim .sheet[role=dialog] #st")).not.toBeNull(); // mounted through Sheet.svelte
    }
  });

  it("renders the rematch card only when a previous game has 3+ players", () => {
    expect($(".rmc")).toBeNull();
    m.state.rc = { gid: null, pl: [{ n: "A", a: 0 }, { n: "B", a: 1 }] };
    m.setup();
    expect($(".rmc")).toBeNull();
    m.state.rc = { gid: null, pl: [{ n: "A", a: 0 }, { n: "B", a: 1 }, { n: "C", a: 2 }] };
    m.setup();
    expect($(".rmc .rname").textContent).toBe("Data trecută");
    expect($(".page2").firstElementChild.classList.contains("rmc")).toBe(true);
  });

  it("remounting replaces the screen instead of stacking copies", () => {
    for (let i = 0; i < 3; i++) m.setup();
    expect(document.querySelectorAll(".hero2")).toHaveLength(1);
    expect(document.querySelectorAll("main.page2")).toHaveLength(1);
    expect(document.querySelectorAll("footer.dock")).toHaveLength(1);
    expect(app().children).toHaveLength(3); // header, main, footer - nothing leaked into #app
  });

  it("tears down cleanly after state changed while it was mounted", () => {
    m.state.players.push({ n: "Nou", a: 3 });
    flushSync(); // #pv / #sum / ... were just repainted by their bindings
    expect(() => m.go("intro")).not.toThrow();
    expect($(".hero2")).toBeNull();
    expect(() => m.setup()).not.toThrow(); // and the screen can come back afterwards
    expect($(".hero2")).not.toBeNull();
  });

  it("sets the home flags and numbers the entrance animation (--k) on the screen's children", () => {
    expect(document.body.classList.contains("home")).toBe(true);
    expect([...app().children].map((e: any) => e.style.getPropertyValue("--k"))).toEqual(["0", "1", "2"]);
    expect([...$(".page2").children].map((e: any) => e.style.getPropertyValue("--k"))).toEqual(["0", "1", "2", "3", "4"]);
  });
});
