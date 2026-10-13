/** The English word lists (src/lib/data/words/en): playable, clean, and without repeats across categories. */
import { afterEach, describe, expect, it } from "vitest";
import { availableCategories, loadWords, cachedWords, playableLangs, setWordLang, getWordLang, hasWords } from "#lib/data/words/index.ts";
import { wordProblem, cleanWord } from "../../scripts/words/lib.mjs";

afterEach(() => {
  setWordLang("ro");
});

describe("English word lists", () => {
  it("English is playable and offers its categories", () => {
    expect(playableLangs()).toContain("en");
    expect(availableCategories("en").length).toBeGreaterThanOrEqual(8);
    expect(hasWords("Animale", "en")).toBe(true);
    expect(hasWords("Politicieni", "en")).toBe(hasWords("Politicieni", "en"));
  });

  it("every English word is clean and no word repeats inside the language", async () => {
    expect(setWordLang("en")).toBe(true);
    expect(getWordLang()).toBe("en");
    const cats = availableCategories("en");
    await loadWords(cats);
    const seen = new Map<string, string>();
    const problems: string[] = [];
    for (const c of cats) {
      const words = cachedWords(c) ?? [];
      expect(words.length, c).toBeGreaterThan(20);
      for (const w of words) {
        const p = wordProblem(cleanWord(w)) || (cleanWord(w) !== w ? "needs cleaning" : null);
        if (p) problems.push(`${c}: "${w}" ${p}`);
        const k = w.toLowerCase();
        if (seen.has(k)) problems.push(`"${w}" is in both ${seen.get(k)} and ${c}`);
        else seen.set(k, c);
      }
    }
    expect(problems).toEqual([]);
  });

  it("switching back to Romanian gives the Romanian lists", async () => {
    setWordLang("en");
    setWordLang("ro");
    await loadWords(["Animale"]);
    expect(cachedWords("Animale")).toContain("câine");
  });
});
