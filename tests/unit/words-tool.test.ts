/** The word tool's pure helpers (scripts/words/lib.mjs): cleaning, filtering, prompt and list-file editing. */
import { describe, expect, it } from "vitest";
import { PRESETS, buildQuery, parseBindings, rank, resolveCountries, titleFromUrl } from "../../scripts/words/wikidata.mjs";
import { appendWords, buildPrompt, buildTranslatePrompt, isLocalCategory, parseTranslation, cleanWord, filterCandidates, parseCategories, parseModelReply, parsePending, parseProtected, parseWords, renderPending, setCount, wordProblem } from "../../scripts/words/lib.mjs";

describe("word tool", () => {
  it("reads the category table and the protected packs from index.ts", () => {
    const src = `const LOADERS = {\n  "Animale": () => import("./animale.ts").then(m => m.animale),\n  "Paște și Halloween": () => import("./paste-halloween.ts").then(m => m.pasteHalloween),\n};\nexport const OPTIONAL_PACKS: Record<string, string> = { "Petrecere": "pty" };\nexport const NEW_IN_V2: string[] = ["Vacanță", "Basme"];`;
    expect(parseCategories(src)).toEqual([{ name: "Animale", file: "animale", exportName: "animale" }, { name: "Paște și Halloween", file: "paste-halloween", exportName: "pasteHalloween" }]);
    expect(parseProtected(src)).toEqual({ newInV2: ["Vacanță", "Basme"], optional: ["Petrecere"] });
  });

  it("cleans words: cedilla to comma-below, spaces, NFC", () => {
    expect(cleanWord("  ştrand   ţară ")).toBe("ștrand țară");
  });

  it("rejects bad words and duplicates, keeps good ones", () => {
    const { ok, rejected } = filterCandidates(["Pisică", "câine", "a,b", "sex shop", "violoncel", "pisică", "x".repeat(70)], new Set(["câine"]));
    expect(ok).toEqual(["Pisică", "violoncel"]);
    expect(rejected.map((r: { why: string }) => r.why)).toEqual(["already exists", "contains , | \" or \\", "blocked word", "already exists", "too long"]);
    expect(wordProblem("un doi trei patru cinci șase șapte opt nouă", 8)).toMatch(/more than 8/);
  });

  it("respects the requested count", () => {
    expect(filterCandidates(["a1", "b2", "c3"], new Set(), 2).ok).toEqual(["a1", "b2"]);
  });

  it("parses the model reply even with fences or text around it", () => {
    expect(parseModelReply("Here:\n```json\n[\"a\", \"b\", 3]\n```")).toEqual(["a", "b"]);
    expect(() => parseModelReply("no list")).toThrow();
  });

  it("builds a prompt with the category, the language and the existing words", () => {
    const p = buildPrompt({ category: "Animale", lang: "ro", count: 10, existing: ["pisică", "câine"], sample: ["pisică"] });
    expect(p).toContain("Animale");
    expect(p).toContain("Romanian");
    expect(p).toContain("pisică, câine");
    expect(p).toContain("comma-below");
  });

  it("round-trips the review file", () => {
    const txt = renderPending({ category: "Animale", lang: "ro", words: ["zebră", "girafă"] });
    expect(parsePending(txt)).toEqual({ category: "Animale", lang: "ro", words: ["zebră", "girafă"] });
  });

  it("appends to a list file in its own style and reads it back", () => {
    const src = `export const x: string[] = [\n  "a",\n  "b"\n];\n`;
    const next = appendWords(src, ["c", "d"]);
    expect(next).toBe(`export const x: string[] = [\n  "a",\n  "b",\n  "c",\n  "d",\n];\n`);
    expect(parseWords(next)).toEqual(["a", "b", "c", "d"]);
  });

  it("updates the count line", () => {
    expect(setCount(`  "Transport": 52,\n  "Sport": 54\n`, "Transport", 60)).toBe(`  "Transport": 60,\n  "Sport": 54\n`);
    expect(setCount(`  "Sport": 54`, "Nope", 1)).toBeNull();
  });

  it("review lines may carry a note that is ignored on apply", () => {
    expect(parsePending("# category: A\n# lang: en\nTaylor Swift  # 180 languages\nAdele\n").words).toEqual(["Taylor Swift", "Adele"]);
  });
});

describe("wikidata source", () => {
  it("builds a query from the preset, the language and the country, with a safe shape", () => {
    const q = buildQuery({ preset: PRESETS["Personalități"], lang: "ro", countries: ["Q218"], minLinks: 6, limit: 200 });
    expect(q).toContain("wd:Q218");
    expect(q).toContain("https://ro.wikipedia.org/");
    expect(q).toContain('LANG(?label) = "ro"');
    expect(q).toContain("FILTER NOT EXISTS");
    expect(q).toContain("ORDER BY DESC(?links)");
    expect(() => buildQuery({ preset: PRESETS["Personalități"], lang: 'ro"} DROP', countries: [], minLinks: 1 })).toThrow();
    expect(() => buildQuery({ preset: { kind: "person", occ: ["Q1; DELETE"] }, lang: "en", countries: [], minLinks: 1 })).toThrow();
  });

  it("works presets use the country of origin, people presets the citizenship", () => {
    expect(buildQuery({ preset: PRESETS["Filme și seriale românești"], lang: "ro", countries: ["Q218"], minLinks: 5 })).toContain("wdt:P495");
    expect(buildQuery({ preset: PRESETS["Politicieni"], lang: "en", countries: ["Q30"], minLinks: 40 })).toContain("wdt:P27");
  });

  it("reads the answer once per item and decodes the article title", () => {
    const rows = [1, 1, 2].map(n => ({ item: { value: `http://www.wikidata.org/entity/Q${n}` }, label: { value: `P${n}` }, links: { value: String(10 * n) }, article: { value: "https://ro.wikipedia.org/wiki/Mihaela_R%C4%83dulescu" } }));
    const out = parseBindings({ results: { bindings: rows } });
    expect(out.map((x: { id: string }) => x.id)).toEqual(["Q1", "Q2"]);
    expect(titleFromUrl("https://ro.wikipedia.org/wiki/Mihaela_R%C4%83dulescu")).toBe("Mihaela_Rădulescu");
  });

  it("ranks by page views when known, else by number of languages", () => {
    const items = [{ id: "A", links: 50 }, { id: "B", links: 90 }, { id: "C", links: 10 }];
    expect(rank(items).map((x: { id: string }) => x.id)).toEqual(["B", "A", "C"]);
    expect(rank(items, new Map([["C", 1000], ["A", 5]])).map((x: { id: string }) => x.id)).toEqual(["C", "A", "B"]);
  });

  it("countries: Romania is the default for Romanian local categories, other languages are worldwide unless told", () => {
    expect(resolveCountries({ preset: PRESETS["Personalități"], lang: "ro" }).codes).toEqual(["RO"]);
    expect(resolveCountries({ preset: PRESETS["Personalități"], lang: "en" }).codes).toEqual([]);
    expect(resolveCountries({ preset: PRESETS["Personalități"], lang: "en", country: "us,gb" }).codes).toEqual(["US", "GB"]);
    expect(() => resolveCountries({ preset: PRESETS["Muzică românească"], lang: "en" })).toThrow(/specific to RO/);
    expect(() => resolveCountries({ preset: PRESETS["Personalități"], lang: "en", country: "xx" })).toThrow(/Unknown country/);
  });
});

describe("universal vs local categories", () => {
  it("animals are universal, celebrities are local", () => {
    expect(isLocalCategory("Animale")).toBe(false);
    expect(isLocalCategory("Personalități")).toBe(true);
  });

  it("the translate prompt keeps the concept and numbers the Romanian words", () => {
    const p = buildTranslatePrompt({ category: "Animale", lang: "en", words: ["pisică", "câine"] });
    expect(p).toContain("1. pisică");
    expect(p).toContain("2. câine");
    expect(p).toContain("SAME concept");
    expect(p).toContain("exactly 2 items");
  });

  it("reads a translation in order, skipping nulls, and refuses a wrong length", () => {
    expect(parseTranslation('["cat", null, "dog"]', ["pisică", "x", "câine"])).toEqual([{ ro: "pisică", tr: "cat" }, { ro: "câine", tr: "dog" }]);
    expect(() => parseTranslation('["cat"]', ["a", "b"])).toThrow(/Expected 2/);
  });
});
