/** Twin words and known partners: who sees what on the card. */
import { describe, expect, it } from "vitest";
import { cardFor, pairProblems, partnersAvailable, partnersOf, pickTwin } from "#lib/game/twins.ts";

const r = (o: object) => ({ word: "pisică", intr: [1], troll: false, ...o }) as any;

describe("cardFor", () => {
  it("normal round: the intruder sees INTRUS", () => {
    expect(cardFor(r({}), 1)).toEqual({ intruder: true, secret: "pisică" });
    expect(cardFor(r({}), 0)).toEqual({ intruder: false, secret: "pisică" });
  });
  it("twin words: the intruder's card looks like everybody's, with the twin word", () => {
    const x = r({ tn: true, twin: "tigru" });
    expect(cardFor(x, 1)).toEqual({ intruder: false, secret: "tigru" });
    expect(cardFor(x, 0)).toEqual({ intruder: false, secret: "pisică" });
  });
  it("twin words + troll round: everybody gets word A", () => {
    const x = r({ tn: true, twin: "tigru", troll: true, intr: [0, 1, 2] });
    for (const i of [0, 1, 2]) expect(cardFor(x, i)).toEqual({ intruder: false, secret: "pisică" });
  });
  it("the double agent still gets the related word", () => {
    expect(cardFor(r({ da: 0, word2: "câine" }), 0)).toEqual({ intruder: false, secret: "câine" });
  });
});

describe("partnersOf", () => {
  it("each intruder sees the other intruders, civilians see nobody", () => {
    const x = r({ kn: true, intr: [1, 3, 4] });
    expect(partnersOf(x, 1)).toEqual([3, 4]);
    expect(partnersOf(x, 3)).toEqual([1, 4]);
    expect(partnersOf(x, 0)).toEqual([]);
  });
  it("nobody in a troll round or when the mode is off", () => {
    expect(partnersOf(r({ kn: true, troll: true, intr: [0, 1] }), 0)).toEqual([]);
    expect(partnersOf(r({ kn: false, intr: [0, 1] }), 0)).toEqual([]);
  });
  it("needs 2 intruders and 6 players", () => {
    expect(partnersAvailable(6, 2)).toBe(true);
    expect(partnersAvailable(5, 2)).toBe(false);
    expect(partnersAvailable(8, 1)).toBe(false);
  });
});

describe("pickTwin", () => {
  const pool = [{ a: "pisică", b: "tigru", cat: "Animale" }, { a: "cafea", b: "ceai", cat: "Mâncare" }];
  it("is null for an empty pool, otherwise one of the pairs in either order", () => {
    expect(pickTwin([], () => 0)).toBeNull();
    const p = pickTwin(pool, () => 0)!;
    expect([p.a, p.b].sort()).toEqual(["pisică", "tigru"].sort());
    const q = pickTwin(pool, () => 0.9)!;
    expect(q.cat).toBe("Mâncare");
  });
  it("skips recent words when something else is left", () => {
    expect(pickTwin(pool, () => 0, ["Pisică"])!.cat).toBe("Mâncare");
    expect(pickTwin(pool, () => 0, ["pisică", "cafea"])).not.toBeNull();
  });
});

describe("pairProblems", () => {
  it("flags identical, duplicate, cedilla and blank pairs", () => {
    expect(pairProblems([["a", "b"], ["c", "d"]])).toEqual([]);
    expect(pairProblems([["a", "A"]]).length).toBe(1);
    expect(pairProblems([["a", "b"], ["B", "a"]]).length).toBe(1);
    expect(pairProblems([["mașină", "ma\u015Fină"]]).length).toBeGreaterThan(0);
    expect(pairProblems([["a", ""]]).length).toBeGreaterThan(0);
  });
});
