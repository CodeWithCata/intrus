// @vitest-environment jsdom
/** Behaviour of the Svelte-mounted intro screen that a DOM snapshot cannot prove: the slider reacting to scrolling, and teardown. */
import { flushSync, mount } from "svelte";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { installShell } from "./helpers/screen.ts";

let m: any;
const $ = (sel: string) => document.querySelector(sel) as any;
const dots = () => [...document.querySelectorAll(".idots i")].map((i) => i.classList.contains("on"));

beforeAll(async () => {
  installShell();
  const [settings, nav, App] = await Promise.all([
    import("#lib/stores/settings.svelte.ts"),
    import("#lib/stores/nav.svelte.ts"),
    import("#lib/App.svelte")
  ]);
  m = { ...settings, ...nav };
  settings.initAppEl();
  mount(App.default, { target: document.querySelector("#app")! });
});

beforeEach(() => {
  m.go("intro");
  flushSync();
});

/** jsdom has no layout: give the slider a width and a scroll position, then fire the scroll event. */
function scrollTo(slide: number) {
  const sl = $("#isl");
  Object.defineProperty(sl, "clientWidth", { value: 300, configurable: true });
  Object.defineProperty(sl, "scrollLeft", { value: slide * 300, configurable: true });
  sl.dispatchEvent(new Event("scroll"));
  flushSync();
}

describe("intro screen (Svelte)", () => {
  it("starts on the first slide", () => {
    expect(dots()).toEqual([true, false, false]);
    expect($("#inx span").textContent).toBe("Mai departe");
    expect(document.body.classList.contains("home")).toBe(true);
  });

  it("moves the active dot and relabels the button as the slider scrolls", () => {
    scrollTo(1);
    expect(dots()).toEqual([false, true, false]);
    expect($("#inx span").textContent).toBe("Mai departe");

    scrollTo(2); // last slide
    expect(dots()).toEqual([false, false, true]);
    expect($("#inx span").textContent).toBe("Să jucăm");

    scrollTo(0);
    expect(dots()).toEqual([true, false, false]);
    expect($("#inx span").textContent).toBe("Mai departe");
  });

  it("is destroyed when another screen replaces it", () => {
    m.go("setup");
    flushSync();
    expect($("#isl")).toBeNull();
    expect($(".hero2")).not.toBeNull();
  });
});
