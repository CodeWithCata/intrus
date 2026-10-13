/** Word lists per language: Romanian is built in, another language is a words/<lang>/ folder, a category without a list is not offered. */
import { describe, expect, it } from "vitest";
import { CATEGORIES, CAT_FILE, availableCategories, getWordLang, hasWords, playableLangs, setWordLang, wordLangs } from "#lib/data/words/index.ts";
import { CATEGORY_NAMES, catName } from "#lib/data/category-names.ts";

describe("word languages", () => {
  it("Romanian is always there and offers every category", () => {
    expect(wordLangs()).toContain("ro");
    expect(playableLangs()).toContain("ro");
    expect(availableCategories("ro")).toEqual(CATEGORIES);
    expect(getWordLang()).toBe("ro");
  });

  it("a language without lists is not offered and cannot be switched to", () => {
    expect(hasWords("Animale", "xx")).toBe(false);
    expect(availableCategories("xx")).toEqual([]);
    expect(setWordLang("xx")).toBe(false);
    expect(getWordLang()).toBe("ro");
  });

  it("every category has a file name, so another language can find its list", () => {
    for (const c of [...CATEGORIES, "Petrecere"]) expect(CAT_FILE[c], c).toBeTruthy();
  });

  it("every category has an English name, and an unknown language falls back to Romanian", () => {
    for (const c of [...CATEGORIES, "Petrecere"]) expect(CATEGORY_NAMES.en[c], c).toBeTruthy();
    expect(catName("Animale", "en")).toBe("Animals");
    expect(catName("Animale", "ro")).toBe("Animale");
    expect(catName("Animale", "xx")).toBe("Animale");
  });
});
