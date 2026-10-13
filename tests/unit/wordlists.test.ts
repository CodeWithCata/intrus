import { beforeAll, describe, expect, it } from "vitest";
import { CATEGORIES, cachedWords, loadAllWords } from "#lib/data/words/index.ts";
import { WORD_COUNTS } from "#lib/data/words/counts.ts";

describe("word lists", () => {
  beforeAll(loadAllWords);

  it("has the 34 categories (26 + the 8 added in v2; the optional Petrecere pack is separate)", () => {
    expect(CATEGORIES.length).toBe(34);
  });

  it("every category has enough words and no duplicates", () => {
    for (const c of CATEGORIES) {
      const words = cachedWords(c)!;
      expect(words.length).toBeGreaterThan(10);
      expect(new Set(words.map((w) => w.toLowerCase())).size).toBe(words.length);
    }
  });

  it("WORD_COUNTS matches the real lists", () => {
    for (const c of CATEGORIES) expect(WORD_COUNTS[c]).toBe(cachedWords(c)!.length);
  });
});
