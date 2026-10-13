/**
 * Word packs for the server, built from the client's word lists (one source of truth: src/lib/data/words).
 * The game is Romanian-only today, so both language slots hold the same list; twin pairs ride along when the category has them. The pack id is the category name,
 * the same string the client uses for a selected category.
 */
import { CATEGORIES, loadCategory } from "../src/lib/data/words/index.ts";
import { hasPairs, loadPairs, cachedPairs } from "../src/lib/data/words/pairs/index.ts";
import type { WordPack } from "./types.ts";

let cached: Promise<WordPack[]> | null = null;

export function loadPacks(): Promise<WordPack[]> {
  cached ??= Promise.all(
    CATEGORIES.map(async (name): Promise<WordPack> => {
      const words = await loadCategory(name);
      // Twin-word pairs (Romanian only): the categories without pairs simply have none.
      await loadPairs([name]);
      const pairs = hasPairs(name) ? cachedPairs(name) : undefined;
      return { id: name, name: { ro: name, en: name }, words: { ro: words, en: words }, ...(pairs ? { pairs } : {}) };
    })
  );
  return cached;
}
