// @vitest-environment jsdom
/**
 * The timer choices in the rules sheet: 1, 2, 3, 5 minutes and "Fără". The 1-minute preset is for short games; the segmented
 * control has five options, so its grid and its sliding pill must use five columns (--n), and every 1-minute path
 * (setting, saved state, talk seconds, online mapping) must keep the 1.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { flushSync, mount } from "svelte";
import { byText, installShell } from "./helpers/screen.ts";

let m: any;

beforeAll(async () => {
  installShell();
  const [settings, rules, App, relaxed] = await Promise.all([
    import("#lib/stores/settings.svelte.ts"),
    import("#lib/components/rules/rules-ui.ts"),
    import("#lib/App.svelte"),
    import("#lib/game/relaxed.ts")
  ]);
  m = { ...settings, ...rules, ...relaxed };
  settings.initAppEl();
  mount(App.default, { target: document.querySelector("#app")! });
});

describe("timer presets", () => {
  it("offers 1, 2, 3, 5 minutes and no timer, in that order", () => {
    expect(m.TIMES).toEqual([1, 2, 3, 5, 0]);
  });

  it("the rules sheet shows them as a five-column segmented control that selects the saved value", () => {
    m.state.tm = 1;
    m.state.sheet = "rules";
    flushSync();
    const one = byText("#sr .seg button", "1 min")!;
    expect(one).toBeTruthy();
    const seg = one.parentElement!;
    expect([...seg.querySelectorAll("button")].map((b) => b.textContent?.trim())).toEqual(["1 min", "2 min", "3 min", "5 min", "Fără"]);
    expect(seg.style.getPropertyValue("--n")).toBe("5");
    expect(seg.style.getPropertyValue("--i")).toBe("0");
    expect(one.getAttribute("aria-pressed")).toBe("true");
  });

  it("tapping 1 min sets state.tm to 1 and the summary line says '1 min'", () => {
    m.state.tm = 3;
    flushSync();
    byText("#sr .seg button", "1 min")!.click();
    flushSync();
    expect(m.state.tm).toBe(1);
    expect(m.rv()).toContain("1 min");
    m.state.sheet = "";
    flushSync();
  });

  it("a 1-minute round talks for 60 s (90 s relaxed, 30 s with Blitz)", () => {
    expect(m.talkSeconds(1, false, false)).toBe(60);
    expect(m.talkSeconds(1, true, false)).toBe(90);
    expect(m.talkSeconds(1, false, true)).toBe(30);
  });
});
