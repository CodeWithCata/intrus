// @vitest-environment jsdom
/**
 * Behaviour of the Svelte game screens (pass, talk, vote, tally, reveal, scoreboard): what each one
 * renders for a given round, and the in-place interactions the old string screens had (holding the
 * card, enabling the "next" button). The full flow is also covered by boot.smoke.test.ts.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { flushSync, mount } from "svelte";
import { byText, installShell, plain } from "./helpers/screen.ts";

let m: any;
const $ = (sel: string) => document.querySelector(sel) as any;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as any[];
const text = (sel: string) => $(sel)?.textContent;

beforeAll(async () => {
  installShell();
  const [settings, ui, nav, engine, App] = await Promise.all([
    import("#lib/stores/settings.svelte.ts"),
    import("#lib/stores/ui.svelte.ts"),
    import("#lib/stores/nav.svelte.ts"),
    import("#lib/game/engine.ts"),
    import("#lib/App.svelte")
  ]);
  // go() changes the state; flushSync() lets App.svelte render the screen (and run its after-render effect).
  const go = (screen: string, props?: any) => {
    nav.go(screen as any, props);
    flushSync();
  };
  const end = (o: number) => {
    engine.end(o);
    flushSync();
  };
  m = { ...settings, ...ui, go, end, base: plain(settings.state) };
  settings.initAppEl();
  mount(App.default, { target: document.querySelector("#app")! });
});

beforeEach(() => {
  Object.assign(m.state, plain(m.base));
  m.state.players = [{ n: "Ana", a: 0 }, { n: "", a: 1 }, { n: "Dan", a: 2 }];
  m.state.scores = { 0: 0, 1: 0, 2: 0 };
  m.state.cd = "classic";
  m.state.rv = "flip";
  m.state.qm = false;
  m.state.gt = false; // card tests open the card step at once; the gate has its own tests below
  m.state.tm = 3;
  m.resetRound({ word: "Farmacie", cat: "Locuri", intr: [1], troll: false, first: 0, votes: [], hint: "Categoria: Locuri", tw: null });
});

const press = (el: Element) => el.dispatchEvent(new Event("pointerdown"));
const release = (el: Element) => el.dispatchEvent(new Event("pointerup"));

describe("pass gate", () => {
  it("shows who should take the phone first and opens the card only after the tap", () => {
    m.state.gt = true;
    m.go("pass", { i: 0 });
    expect($("#gt")).not.toBeNull();
    expect($("#card")).toBeNull();
    $("#gt").click();
    flushSync();
    expect($("#gt")).toBeNull();
    expect($("#card")).not.toBeNull();
  });

  it("starts on the gate again for the next player", () => {
    m.state.gt = true;
    m.go("pass", { i: 0 });
    $("#gt").click();
    flushSync();
    m.go("pass", { i: 1 });
    expect($("#gt")).not.toBeNull();
    expect($("#card")).toBeNull();
  });
});

describe("pass screen", () => {
  it("shows the player, the step dots and a disabled next button", () => {
    m.go("pass", { i: 0 });
    expect(text(".who h1")).toBe("Ana");
    expect(text("header .muted.small")).toBe("Jucătorul 1 din 3");
    expect($$(".steps i")).toHaveLength(3);
    expect($$(".steps i.on")).toHaveLength(1);
    expect($("#card").dataset.cd).toBe("classic");
    expect($("#face").textContent).toBe("");
    expect($("#nx").disabled).toBe(true);
    expect(text("#nx")).toBe("Pasează mai departe");
    expect(text("#nt")).toBe("Vezi mai întâi cartea");
  });

  it("labels the last player's button 'Începe discuția'", () => {
    m.go("pass", { i: 2 });
    expect(text("#nx")).toBe("Începe discuția");
    expect($$(".steps i.on")).toHaveLength(3);
  });

  it("holding the card shows the word, releasing hides it, and the next button stays enabled", () => {
    m.go("pass", { i: 0 });
    press($("#card"));
    expect($("#card").classList.contains("open")).toBe(true);
    expect($("#card").classList.contains("civ")).toBe(true);
    expect(text("#face .secret")).toBe("Farmacie");
    expect($("#nx").disabled).toBe(false);
    expect(text("#nt")).toBe("Gata? Pasează telefonul.");

    release($("#card"));
    expect($("#card").classList.contains("open")).toBe(false);
    expect($("#face").textContent).toBe("");
    expect($("#nx").disabled).toBe(false);
  });

  it("shows INTRUS and the hint to an intruder", () => {
    m.go("pass", { i: 1 });
    press($("#card"));
    expect($("#card").classList.contains("bad")).toBe(true);
    expect(text("#face .stamp")).toBe("INTRUS");
    expect(text("#face .hintline")).toBe("Categoria: Locuri");
  });

  it("shows the related word to the double agent", () => {
    Object.assign(m.round, { tw: "ag", da: 0, word2: "Spital" });
    m.go("pass", { i: 0 });
    press($("#card"));
    expect(text("#face .secret")).toBe("Spital");
  });

  it("escapes player names", () => {
    m.state.players[0].n = "<b>x</b>";
    m.go("pass", { i: 0 });
    expect(text(".who h1")).toBe("<b>x</b>");
    expect($(".who h1 b")).toBeNull();
  });

  it("goes to the discussion after the last player", () => {
    m.go("pass", { i: 3 });
    expect(byText("button", "Trecem la vot")).toBeDefined();
  });

  it("the next button moves on to the following player", () => {
    m.go("pass", { i: 0 });
    $("#nx").disabled = false; // enabled by holding the card in a real browser
    $("#nx").click();
    flushSync();
    expect(text(".who h1")).toBe("Jucător 2");
    expect(text("header .muted.small")).toBe("Jucătorul 2 din 3");
  });
});

describe("vote screen", () => {
  it("lists every other player as a suspect and starts with a disabled confirm button", () => {
    m.go("vote", { i: 1 });
    expect(text(".who h1")).toBe("Jucător 2");
    expect(text("header .muted.small")).toBe("Votul 2 din 3");
    const suspects = $$(".suspect");
    expect(suspects.map((b) => b.textContent)).toEqual(["Ana", "Dan"]);
    expect(suspects.every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect($("#ok").disabled).toBe(true);
    expect(m.round.pk).toBeNull();
  });

  it("picking a suspect marks only that one and enables the confirm button", () => {
    m.go("vote", { i: 1 });
    const [ana, dan] = $$(".suspect");
    ana.click();
    expect(ana.getAttribute("aria-pressed")).toBe("true");
    expect(dan.getAttribute("aria-pressed")).toBe("false");
    expect($("#ok").disabled).toBe(false);
    expect(m.round.pk).toBe(0);
    dan.click();
    flushSync();
    expect(ana.getAttribute("aria-pressed")).toBe("false");
    expect(dan.getAttribute("aria-pressed")).toBe("true");
    expect(m.round.pk).toBe(2);
  });

  it("confirming records the vote and shows the next voter", () => {
    m.go("vote", { i: 1 });
    $$(".suspect")[1].click();
    $("#ok").click();
    flushSync();
    expect(m.round.votes).toEqual([2]);
    expect(text(".who h1")).toBe("Dan");
    expect(text("header .muted.small")).toBe("Votul 3 din 3");
    expect($("#ok").disabled).toBe(true); // a fresh screen
  });

  it("goes to the tally after the last vote", () => {
    m.round.votes = [1, 1, 0];
    m.go("vote", { i: 3 });
    expect(text("h1")).toBe("Voturile");
  });
});

describe("tally screen", () => {
  it("highlights the most voted player", () => {
    m.round.votes = [1, 1, 0];
    m.go("tally");
    expect(m.round.top).toEqual([1]);
    expect($$("ul .score")).toHaveLength(3);
    expect($$("ul .score.top")).toHaveLength(1);
    expect(text("ul .score.top .name")).toBe("Jucător 2");
    expect(byText("button", "Dezvăluie intrusul")).toBeDefined();
  });

  it("highlights every player of a tie", () => {
    m.round.votes = [0, 1, 2];
    m.go("tally");
    expect(m.round.top).toEqual([0, 1, 2]);
    expect($$("ul .score.top")).toHaveLength(3);
  });
});

describe("reveal screen", () => {
  it("reveals the intruder, the word and the verdict of the vote", () => {
    m.round.top = [1];
    m.state.players[1].ti = "Detectivul";
    m.go("reveal");
    expect(text(".muted")).toBe("Intrusul era");
    expect($$(".stage > div")).toHaveLength(1);
    expect(text(".stage .h2")).toBe("Jucător 2");
    expect(text(".stage .ptl")).toBe("Detectivul");
    expect(text(".wordtag")).toBe("Farmacie");
    expect(text(".verdict")).toBe("Votul l-a prins.");
    expect($$(".outcome")).toHaveLength(3);
    expect($$(".outcome").map((b) => b.classList.contains("rec"))).toEqual([true, false, false]);
    expect($$(".outcome .pts").map((e) => e.textContent)).toEqual(["+1 ceilalți", "+1 intrus", "+2 intrus"]);
  });

  it("recommends 'A scăpat' when the vote missed, and nothing when nobody voted", () => {
    m.round.top = [0];
    m.go("reveal");
    expect(text(".verdict")).toBe("Votul a greșit.");
    expect($$(".outcome").map((b) => b.classList.contains("rec"))).toEqual([false, false, true]);

    delete m.round.top;
    m.go("reveal");
    expect($(".verdict")).toBeNull();
    expect($(".outcome.rec")).toBeNull();
  });

  it("doubles the points and notes the twist on 'dublu sau nimic' rounds", () => {
    Object.assign(m.round, { tw: "dbl", top: [1] });
    m.go("reveal");
    expect($$(".outcome .pts").map((e) => e.textContent)).toEqual(["+2 ceilalți", "+2 intrus", "+4 intrus"]);
    expect(text(".starter")).toContain("Dublu sau nimic");
  });

  it("says 'Intrușii erau' with several intruders", () => {
    m.round.intr = [0, 1];
    m.go("reveal");
    expect(text(".muted")).toBe("Intrușii erau");
    expect($$(".stage > div")).toHaveLength(2);
  });

  it("shows the surprise screen when everybody was an intruder", () => {
    Object.assign(m.round, { troll: true, intr: [0, 1, 2] });
    m.go("reveal");
    expect(text(".stamp.red")).toBe("SURPRIZĂ");
    expect($$(".stage > div")).toHaveLength(3);
    expect(text(".wordtag")).toBe("Farmacie");
    expect(byText("button", "Continuă")).toBeDefined();
  });

  it("an outcome button scores the round", () => {
    m.round.top = [1];
    m.go("reveal");
    $$(".outcome")[0].click(); // "Prins": the two civilians get +1
    flushSync();
    expect(text("h1")).toBe("Clasament");
    expect(m.state.scores).toEqual({ 0: 1, 1: 0, 2: 1 });
  });
});

describe("scoreboard screen", () => {
  it("ranks the players and shows the points earned this round", () => {
    m.end(0); // intruder caught: the two others get +1
    expect(text("h1")).toBe("Clasament");
    const rows = $$(".full .score");
    expect(rows).toHaveLength(3);
    expect(rows[0].classList.contains("top")).toBe(true);
    expect(rows[0].querySelector(".rank svg")).not.toBeNull();
    expect(rows[1].querySelector(".rank").textContent).toBe("2");
    expect(rows[0].querySelector(".name").textContent).toContain("Ana");
    expect(rows[0].querySelector(".name .muted").textContent).toBe("+1");
    expect(rows[2].querySelector(".name .muted")).toBeNull(); // the intruder earned nothing
    expect(m.state.scores).toEqual({ 0: 1, 1: 0, 2: 1 });
  });

  it("offers to save the group only when the players are not in one", () => {
    m.end(0);
    expect(byText(".sum .rname", "Salvează grupul")).toBeDefined();
    for (const label of ["Runda următoare", "Revanșă", "Joc nou"]) {
      expect(byText("footer button", label)).toBeDefined();
    }
  });
});
