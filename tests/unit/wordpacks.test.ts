/** Quality gate for the v2 word packs and the twin-word pairs: no duplicates (inside or across lists), comma-below diacritics, trimmed. */
import { beforeAll, describe, expect, it } from "vitest";
import { CATEGORIES, NEW_IN_V2, OPTIONAL_PACKS, cachedWords, loadAllWords, loadCategory, migrateCats } from "#lib/data/words/index.ts";
import { WORD_COUNTS } from "#lib/data/words/counts.ts";
import { PAIR_CATEGORIES, cachedPairs, loadPairs } from "#lib/data/words/pairs/index.ts";
import { pairProblems } from "#lib/game/twins.ts";

const PACKS = [...NEW_IN_V2, ...Object.keys(OPTIONAL_PACKS)];

beforeAll(async () => {
  await loadAllWords();
  await Promise.all(Object.keys(OPTIONAL_PACKS).map(loadCategory));
  await loadPairs(PAIR_CATEGORIES);
});

describe("v2 word packs", () => {
  it("there are at least 8 new categories with at least 80 words each, plus the optional Petrecere pack", () => {
    expect(NEW_IN_V2.length >= 8).toBe(true);
    for (const c of PACKS) expect(cachedWords(c)!.length >= 80).toBe(true);
    expect(Object.keys(OPTIONAL_PACKS)).toEqual(["Petrecere"]);
  });

  it("Petrecere is an optional pack: not in CATEGORIES (so not selected by default), but it has a list and a count", () => {
    expect(CATEGORIES.includes("Petrecere")).toBe(false);
    expect(WORD_COUNTS["Petrecere"]).toBe(cachedWords("Petrecere")!.length);
  });

  it("no word is repeated inside a pack or between a new pack and any other list", () => {
    const owner = new Map<string, string>();
    for (const c of [...CATEGORIES, ...Object.keys(OPTIONAL_PACKS)]) {
      for (const w of cachedWords(c)!) {
        const k = w.toLowerCase(), prev = owner.get(k);
        if (prev !== undefined && (PACKS.includes(c) || PACKS.includes(prev))) throw new Error(`"${w}" is in both ${prev} and ${c}`);
        owner.set(k, c);
      }
    }
  });

  it("words are trimmed, reasonably short and use comma-below diacritics (ș ț), never cedilla (ş ţ)", () => {
    for (const c of PACKS) for (const w of cachedWords(c)!) {
      expect(w === w.trim() && w.length > 0 && w.length <= 60).toBe(true);
      expect(/[şţŞŢ]/.test(w)).toBe(false);
      expect(/[,|]/.test(w)).toBe(false);
    }
  });

  it("the petrecere pack stays PG-13: a few blocked words never appear", () => {
    const bad = /\b(sex|porno|drog|beat|bețiv|dezbrăc|gol pușcă)/i;
    for (const w of cachedWords("Petrecere")!) expect(bad.test(w)).toBe(false);
  });
});

describe("migrateCats", () => {
  it("someone who had every older category selected gets the new ones too", () => {
    const old = CATEGORIES.filter((c) => !NEW_IN_V2.includes(c));
    const r = migrateCats(old, 1);
    for (const c of NEW_IN_V2) expect(r.includes(c)).toBe(true);
    expect(migrateCats(old, 2)).toEqual(old);
  });
  it("someone who picked a few keeps exactly their choice", () => {
    expect(migrateCats(["Animale", "Sport"], 1)).toEqual(["Animale", "Sport"]);
  });
  it("bad input falls back to every category", () => {
    expect(migrateCats(undefined, 1)).toEqual(CATEGORIES);
  });
});

describe("twin-word pairs", () => {
  it("at least 25 good pairs in at least 6 categories", () => {
    const rich = PAIR_CATEGORIES.filter((c) => cachedPairs(c).length >= 25);
    expect(rich.length >= 6).toBe(true);
  });
  it("every pair is close but different, trimmed, no duplicates, comma-below diacritics", () => {
    for (const c of PAIR_CATEGORIES) expect(pairProblems(cachedPairs(c))).toEqual([]);
  });
  it("every pair category is a real category", () => {
    for (const c of PAIR_CATEGORIES) expect(CATEGORIES.includes(c)).toBe(true);
  });
});
