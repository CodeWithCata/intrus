// @vitest-environment jsdom
/**
 * Smoke test: boots the real app into a jsdom document and drives a whole round through the
 * same buttons a player would tap (Svelte `onclick` on the screens and in the sheets). It catches broken imports,
 * missing handlers and render-time exceptions that type-checking alone cannot.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { flushSync, mount } from "svelte";
import { STORAGE_KEY } from "#lib/storage/keys.ts";

const app = () => document.getElementById("app")!;
/** Tap the button whose label is `text`. */
const tap = (text: string, within = "button") => {
  const el = [...document.querySelectorAll<HTMLElement>(within)].find((e) => e.textContent?.trim() === text);
  if (!el) throw new Error(`Missing button "${text}"\n--- #app ---\n${app().innerHTML.slice(0, 400)}`);
  el.click();
  flushSync();
};
const has = (text: string, within = "button") => [...document.querySelectorAll(within)].some((e) => e.textContent?.trim() === text);
const click = (selector: string) => {
  const el: HTMLElement | null = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}\n--- #app ---\n${app().innerHTML.slice(0, 400)}`);
  el.click();
  flushSync();
};

beforeAll(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (query: string) => ({
    // reduced motion: sheet exit transitions have duration 0 (jsdom has no Web Animations)
    matches: query.includes("prefers-reduced-motion"), media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false
  }));
  window.scrollTo = () => {};
  if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []; // jsdom has no Web Animations
  document.body.innerHTML = '<div id="app"></div><div id="sr"></div>';
  const { boot } = await import("#lib/boot.ts");
  const App = (await import("#lib/App.svelte")).default;
  mount(App, { target: document.getElementById("app")! });
  boot();
  flushSync();
  // the word lists are lazy chunks: load them now so "Începe jocul" starts the round synchronously
  await (await import("#lib/data/words/index.ts")).loadAllWords();
});

describe("app boot", () => {
  it("renders the intro on first run and the setup screen after skipping it", () => {
    expect(app().innerHTML.length).toBeGreaterThan(100);
    tap("Sari peste");
    expect(document.querySelector(".hero2")).not.toBeNull();
    expect(has("Începe jocul")).toBe(true);
  });

  it("opens and closes a bottom sheet", async () => {
    tap("Jucători", ".page2 .sum .rname");
    expect(document.querySelector("#sr .scrim [role=dialog][aria-labelledby=st] #st")).not.toBeNull();
    expect(app().hasAttribute("inert")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    flushSync();
    await vi.advanceTimersByTimeAsync(300); // the exit transition is a Svelte transition (duration 0 here)
    flushSync();
    expect(document.querySelector("#sr .scrim")).toBeNull();
    expect(app().hasAttribute("inert")).toBe(false);
  });

  it("plays a full round: start → pass cards → talk → vote → tally → reveal → scoreboard", () => {
    tap("Începe jocul");
    // pass: one screen per player
    for (let i = 0; i < 3; i++) {
      document.querySelector<HTMLButtonElement>("#gt")!.click(); // the hand-over gate comes before every card
      flushSync();
      expect(document.getElementById("card")).not.toBeNull();
      const next = document.querySelector<HTMLButtonElement>("#nx")!;
      next.disabled = false; // enabled by holding the card in a real browser
      next.click();
      flushSync();
    }
    // talk screen (discussion timer) → vote
    expect(has("Trecem la vot")).toBe(true);
    tap("Trecem la vot");
    // each of the 3 players secretly picks a suspect and confirms
    for (let i = 0; i < 3; i++) {
      expect(document.querySelectorAll(".suspect")).toHaveLength(2);
      click(".suspect");
      const ok = document.querySelector<HTMLButtonElement>("#ok")!;
      expect(ok.disabled).toBe(false);
      ok.click();
      flushSync();
    }
    // tally → reveal → outcome → scoreboard
    expect(document.body.textContent).toContain("Voturile");
    tap("Dezvăluie intrusul");
    vi.advanceTimersByTime(5000);
    click(".outcome"); // the first outcome: "Prins"
    expect(document.body.textContent).toContain("Clasament");
    expect(has("Runda următoare")).toBe(true);
  });

  it("leaves a round and returns to the Svelte-rendered setup screen", () => {
    tap("Joc nou"); // "Joc nou?" confirm sheet from the scoreboard
    tap("Începe", "#sr .acts button"); // the confirm button of the ConfirmSheet
    vi.advanceTimersByTime(500);
    flushSync();
    expect(document.querySelectorAll(".hero2")).toHaveLength(1);
    expect(has("Începe jocul")).toBe(true);
    expect(document.querySelectorAll(".page2 .sum")).toHaveLength(5);
  });

  it("persists progress to localStorage (the autosave effect, no explicit save call)", async () => {
    flushSync();
    await vi.advanceTimersByTimeAsync(1000);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.rounds).toBe(1);
    expect(saved.players).toHaveLength(3);
  });
});
