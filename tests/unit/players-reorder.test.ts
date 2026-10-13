// @vitest-environment jsdom
/** Reordering the players: the order of the list is the order the phone is passed in, and points must follow the people. */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { installShell } from "./helpers/screen.ts";

let state: { players: { n: string; a: number }[]; scores: Record<string, number>; last: number[] };
let movePlayer: (from: number, to: number) => boolean;
beforeAll(async () => {
  installShell();
  ({ state } = await import("#lib/stores/settings.svelte.ts"));
  ({ movePlayer } = await import("#lib/stores/players.svelte.ts"));
});

const names = () => state.players.map((p: { n: string }) => p.n);

beforeEach(() => {
  state.players = ["Ana", "Bob", "Cris", "Dan"].map((n, a) => ({ n, a }));
  state.scores = { 0: 10, 1: 20, 2: 30, 3: 40 };
  state.last = [1, 3];
});

describe("movePlayer", () => {
  it("moves a player down: the ones in between shift up", () => {
    expect(movePlayer(0, 2)).toBe(true);
    expect(names()).toEqual(["Bob", "Cris", "Ana", "Dan"]);
  });

  it("moves a player up: the ones in between shift down", () => {
    expect(movePlayer(3, 1)).toBe(true);
    expect(names()).toEqual(["Ana", "Dan", "Bob", "Cris"]);
  });

  it("keeps every score with its player", () => {
    movePlayer(0, 2); // Ana goes from 0 to 2
    const byName = Object.fromEntries(names().map((n: string, i: number) => [n, state.scores[i]]));
    expect(byName).toEqual({ Ana: 10, Bob: 20, Cris: 30, Dan: 40 });
  });

  it("keeps last round's intruders pointing at the same people", () => {
    movePlayer(0, 2); // Bob (1) and Dan (3) were the intruders
    const intruders = state.last.map((i: number) => state.players[i].n).sort();
    expect(intruders).toEqual(["Bob", "Dan"]);
  });

  it("does nothing for a no-op or an out-of-range move", () => {
    expect(movePlayer(1, 1)).toBe(false);
    expect(movePlayer(-1, 2)).toBe(false);
    expect(movePlayer(0, 4)).toBe(false);
    expect(names()).toEqual(["Ana", "Bob", "Cris", "Dan"]);
    expect(state.scores).toEqual({ 0: 10, 1: 20, 2: 30, 3: 40 });
  });
});
