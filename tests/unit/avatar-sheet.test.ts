// @vitest-environment jsdom
/**
 * The avatar builder sheet, mounted through App: opening it from the players sheet, the quick styles, the four pages (face, hair,
 * clothes, details), tapping a tile, the dice, the photo buttons and "Gata". Uses the real store handlers, so `state.players[i].l`
 * is what the tap really changed.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { flushSync, mount } from "svelte";
import { byText, installShell } from "./helpers/screen.ts";
import { NO_HAT, PLAIN_EXTRAS, codeToLook, isLookCode, playerLook } from "#lib/components/players/avatar-parts.ts";

let m: any;
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const click = (el: HTMLElement | undefined) => {
  expect(el).toBeDefined();
  el!.click();
  flushSync();
};

beforeAll(async () => {
  installShell();
  const [settings, nav, App, edit, players] = await Promise.all([
    import("#lib/stores/settings.svelte.ts"),
    import("#lib/stores/nav.svelte.ts"),
    import("#lib/App.svelte"),
    import("#lib/stores/avatar-edit.svelte.ts"),
    import("#lib/stores/players.svelte.ts")
  ]);
  settings.initAppEl();
  mount(App.default, { target: document.querySelector("#app")! });
  nav.go("setup");
  flushSync();
  m = { state: settings.state, edit, players };
});

beforeEach(() => {
  m.state.players = [{ n: "Ana", a: 0 }, { n: "Bob", a: 1 }, { n: "Cip", a: 2 }];
  m.state.sheet = "players";
  flushSync();
});

const openBuilder = (i = 0) => {
  click($$("#sr .pl .pick")[i]);
  expect(m.state.sheet).toBe("avatar");
};
/** The tiles of one row. Row 0 is always the quick styles; the rows after it belong to the page that is open (see `page`). */
const rows = () => $$("#sr .bld .chips:not(.bldt)"); // the tab strip (.bldt) is a .chips row too, but not one of the part rows
const row = (n: number) => [...rows()[n].querySelectorAll("button")] as HTMLElement[];
/** Opens one of the builder's pages: 0 = face, 1 = hair, 2 = clothes, 3 = details. */
const page = (n: number) => click($$("#sr .bldt button")[n]);
/**
 * Rows per page (after the quick styles):
 *   face    1 skin, 2 glasses|mustache, 3 frames, 4 mouth, 5 brows (frames and mouth only without a mustache)
 *   hair    1 hat, 2 hair, 3 hair colour (only with hair), 4 beard
 *   clothes 1 clothes, 2 tie (only with the shirt)
 *   details 1 lashes, 2 lips (only without a mustache), 3 blush, 4 freckles, 5 earrings
 */

describe("avatar builder sheet", () => {
  it("tapping a player's avatar opens the builder for that player", () => {
    openBuilder(1);
    expect(m.edit.avatarEdit.i).toBe(1);
    expect($("#sr .sheet[data-k=avatar]")).not.toBeNull();
    expect($("#sr .bldp svg.av")).not.toBeNull(); // the big live preview
    expect(rows()).toHaveLength(6); // quick styles + the five rows of the face page
    expect(row(0)).toHaveLength(4);
    expect(row(1)).toHaveLength(3);
    expect(row(5)).toHaveLength(5);
  });

  it("has four pages and shows only the rows of the open one", () => {
    openBuilder(0);
    expect($$("#sr .bldt button")).toHaveLength(4);
    expect($$("#sr .bldt button")[0].getAttribute("aria-pressed")).toBe("true");
    page(1);
    expect(rows()).toHaveLength(4); // styles, hat, hair, beard (no hair colour while bald)
    expect(row(1)).toHaveLength(7);
    expect(row(2)).toHaveLength(8);
    page(2);
    expect(rows()).toHaveLength(3);
    expect(row(1)).toHaveLength(4);
    page(3);
    expect(rows()).toHaveLength(6);
    page(0);
    expect(rows()).toHaveLength(6);
  });

  it("tapping a hat tile changes state.players[i].l live and marks the tile pressed", () => {
    openBuilder(0);
    page(1);
    expect(m.state.players[0].l).toBeUndefined();
    click(row(1)[3]);
    expect(isLookCode(m.state.players[0].l)).toBe(true);
    expect(codeToLook(m.state.players[0].l).hat).toBe(3);
    expect(row(1)[3].getAttribute("aria-pressed")).toBe("true");
    expect(row(1)[0].getAttribute("aria-pressed")).toBe("false");
    expect(m.state.players[1]).toEqual({ n: "Bob", a: 1 }); // nobody else changes
  });

  it("the hat row also offers no hat", () => {
    openBuilder(0);
    page(1);
    click(row(1)[NO_HAT]);
    expect(playerLook(m.state.players[0]).hat).toBe(NO_HAT);
  });

  it("every row changes its own part and leaves the others alone", () => {
    openBuilder(0);
    const before = playerLook(m.state.players[0]);
    click(row(1)[2]); // skin
    click(row(5)[4]); // brows
    page(1);
    click(row(1)[4]); // hat
    click(row(2)[3]); // hair
    click(row(3)[2]); // hair colour (appears once there is hair)
    click(row(4)[1]); // beard
    page(2);
    click(row(1)[2]); // clothes
    page(0);
    click(row(3)[1]); // frames
    click(row(4)[3]); // mouth
    page(3);
    click(row(1)[1]); // lashes
    click(row(2)[1]); // lips
    click(row(3)[1]); // blush
    click(row(4)[1]); // freckles
    click(row(5)[1]); // earrings
    expect(playerLook(m.state.players[0])).toEqual({
      ...before, skin: 2, brows: "flat", hat: 4, hair: 3, hairTone: 2, beard: true, outfit: 2, frames: 1, mouth: 3,
      lashes: true, lips: true, blush: true, freckles: true, earrings: true
    });
  });

  it("the tie row shows only with the shirt, and the hair colour row only with hair", () => {
    openBuilder(0);
    page(2);
    expect(rows()).toHaveLength(3);
    click(row(1)[1]); // blouse
    expect(rows()).toHaveLength(2);
    click(row(1)[0]); // shirt again
    expect(rows()).toHaveLength(3);
    page(1);
    expect(rows()).toHaveLength(4);
    click(row(2)[1]);
    expect(rows()).toHaveLength(5);
  });

  it("with a mustache there are no glasses frames, mouth or lipstick rows", () => {
    openBuilder(0);
    click(row(2)[1]); // mustache
    expect(rows()).toHaveLength(4); // styles, skin, face, brows
    page(3);
    expect(rows()).toHaveLength(5); // no lipstick row
  });

  it("the quick styles set several parts at once and keep the rest", () => {
    openBuilder(0);
    page(1);
    click(row(1)[3]); // a hat, to see that it stays
    click(row(0)[2]); // woman
    const woman = playerLook(m.state.players[0]);
    expect(woman).toMatchObject({ hat: 3, hair: 3, lashes: true, lips: true, earrings: true, outfit: 1, mustache: false, beard: false, tie: false });
    expect(row(0)[2].getAttribute("aria-pressed")).toBe("true");
    expect(row(0)[1].getAttribute("aria-pressed")).toBe("false");
    click(row(0)[1]); // man
    expect(playerLook(m.state.players[0])).toMatchObject({ hat: 3, hair: 1, lashes: false, lips: false, earrings: false, outfit: 0 });
    click(row(0)[3]); // cool
    expect(playerLook(m.state.players[0])).toMatchObject({ hair: 2, outfit: 2, frames: 2, mustache: false });
    click(row(0)[0]); // classic
    expect(playerLook(m.state.players[0])).toMatchObject({ hat: 3, ...PLAIN_EXTRAS });
    expect(row(0)[0].getAttribute("aria-pressed")).toBe("true");
    expect(m.state.players[1]).toEqual({ n: "Bob", a: 1 });
  });

  it("the \"nothing\" choices (no hat, no glasses, no lashes, ...) show a prohibition sign, hair keeps a bald face", () => {
    openBuilder(0);
    const nox = (n: number) => [...rows()[n].querySelectorAll("button")].map((b) => b.querySelector("svg.nox") !== null);
    expect(nox(3)).toEqual([false, false, false, true]); // frames: the last one is "no glasses"
    page(1);
    expect(nox(1)).toEqual([false, false, false, false, false, false, true]); // hat
    expect(nox(2)).toEqual(new Array(8).fill(false)); // hair
    expect(nox(3)).toEqual([true, false]); // beard (no hair colour row while bald)
    page(3);
    expect(nox(1)).toEqual([true, false]); // lashes
    expect(nox(5)).toEqual([true, false]); // earrings
    page(0);
    expect(nox(2)).toEqual([false, false]); // glasses | mustache is a choice, not "nothing"
  });

  it("the tiles are named for screen readers, on every page", () => {
    openBuilder(0);
    for (const n of [0, 1, 2, 3]) {
      page(n);
      const tiles = $$("#sr .bld .chip.tile"); // the tab buttons carry visible text instead
      expect(tiles.length).toBeGreaterThan(0);
      for (const b of tiles) {
        expect((b.getAttribute("aria-label") ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("the dice button gives a valid random look", () => {
    openBuilder(0);
    click(byText("#sr .bldb .chip", "Aleatoriu"));
    expect(isLookCode(m.state.players[0].l)).toBe(true);
  });

  it("photo buttons: adding opens the file picker, removing deletes the photo and keeps the built look", () => {
    openBuilder(0);
    expect(byText("#sr .bldb .chip", "Șterge poza")).toBeUndefined();
    expect(byText("#sr .bldb .chip", "Adaugă o poză")).toBeDefined();
    click(row(1)[2]);
    const l = m.state.players[0].l;
    m.state.players[0].ph = "data:image/jpeg;base64,AAAA";
    flushSync();
    expect($("#sr .bldp svg.av.ph")).not.toBeNull(); // the photo wins in the preview
    click(byText("#sr .bldb .chip", "Șterge poza"));
    expect(m.state.players[0].ph).toBeUndefined();
    expect(m.state.players[0].l).toBe(l);
    expect($("#sr .bldp svg.av.ph")).toBeNull();
  });

  it("shows a soft hint, and does not block anything, when two players have the same face", () => {
    m.state.players[1] = { n: "Bob", a: 0 };
    openBuilder(0);
    expect($("#sr .bldn")).not.toBeNull();
    click(row(1)[1]);
    expect($("#sr .bldn")).toBeNull();
  });

  it("\"Gata\" goes back to the players sheet", () => {
    openBuilder(0);
    click(byText("#sr .sheet > .btn.go", "Gata"));
    expect(m.state.sheet).toBe("players");
    expect($("#sr .sheet[data-k=players]")).not.toBeNull();
  });

  it("the player list shows the built face right away", () => {
    openBuilder(0);
    page(1);
    click(row(1)[5]);
    click(byText("#sr .sheet > .btn.go", "Gata"));
    expect(m.state.sheet).toBe("players");
    expect($$("#sr .pl .pick svg.av")).toHaveLength(3);
  });
});
