/**
 * Pure helpers of the word tool (no network, no files): reading the category table, cleaning and checking words,
 * building the prompt, and editing a word-list source file. words.mjs does the I/O; tests/unit/words-tool.test.ts covers these.
 * The rules mirror tests/unit/wordlists.test.ts and wordpacks.test.ts, so words that pass here pass the tests.
 */

/** Words the party game must never contain (PG-13, same spirit as the Petrecere test). */
export const BLOCKED = /\b(sex|porno|drog|cocain|heroin|beat|bețiv|dezbrăc|gol pușcă|nazist|hitler|viol(ul|are|ez|ator|ată)|sinucid|pedofil|rasist)/i;

/** Categories made of sayings and situations, where a "word" is a whole phrase. */
export const PHRASE_CATEGORIES = ["Proverbe și expresii", "Petrecere"];
export const maxWordsFor = category => (PHRASE_CATEGORIES.includes(category) ? 12 : 8);

export const MAX_LEN = 60;

/** index.ts -> [{ name, file, exportName }]. */
export function parseCategories(indexSource) {
  const out = [];
  const re = /^\s*"([^"]+)":\s*\(\)\s*=>\s*import\("\.\/([^"]+)\.ts"\)\.then\(m\s*=>\s*m\.(\w+)\)/gm;
  let m;
  while ((m = re.exec(indexSource))) {
    out.push({ name: m[1], file: m[2], exportName: m[3] });
  }
  return out;
}

/** The words of a list file: every double-quoted string literal inside the first `[ ... ]`. */
export function parseWords(fileSource) {
  const start = fileSource.indexOf("= [");
  const body = start < 0 ? fileSource : fileSource.slice(start);
  const end = body.indexOf("\n];");
  const inner = end < 0 ? body : body.slice(0, end);
  const words = [];
  for (const m of inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    words.push(JSON.parse(`"${m[1]}"`));
  }
  return words;
}

/** Normalise one candidate: trim, collapse spaces, NFC, cedilla -> comma-below (the tests forbid ş ţ). */
export function cleanWord(raw) {
  return String(raw ?? "")
    .normalize("NFC")
    .replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț")
    .replace(/\s+/g, " ")
    .trim();
}

/** Why a (cleaned) word is not acceptable, or null when it is fine. */
export function wordProblem(w, maxWords = 8) {
  if (!w) return "empty";
  if (w.length > MAX_LEN) return "too long";
  if (/[,|"\\]/.test(w)) return "contains , | \" or \\";
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f]/.test(w)) return "control character";
  if (/^\d+$/.test(w)) return "only digits";
  if (w.split(" ").length > maxWords) return `more than ${maxWords} words`;
  if (BLOCKED.test(w)) return "blocked word";
  return null;
}

/**
 * Filters candidates. `taken` is a Set of lower-cased words that already exist anywhere (every list), so a word is never
 * added twice, inside the batch or across categories. Returns { ok, rejected: [{ word, why }] }.
 */
export function filterCandidates(candidates, taken, limit = Infinity, maxWords = 8) {
  const seen = new Set(taken);
  const ok = [];
  const rejected = [];
  for (const raw of candidates) {
    const w = cleanWord(raw);
    const why = wordProblem(w, maxWords) ?? (seen.has(w.toLowerCase()) ? "already exists" : null);
    if (why) {
      rejected.push({ word: w || String(raw), why });
      continue;
    }
    if (ok.length >= limit) {
      rejected.push({ word: w, why: "over the requested count" });
      continue;
    }
    seen.add(w.toLowerCase());
    ok.push(w);
  }
  return { ok, rejected };
}

const LANGS = { ro: "Romanian", en: "English", de: "German", fr: "French", es: "Spanish", it: "Italian", hu: "Hungarian", pl: "Polish", pt: "Portuguese", nl: "Dutch", tr: "Turkish" };
export const languageName = code => LANGS[code] ?? code;

/** Who the words are for: the model must pick things THIS audience knows, not translate the Romanian list. */
const AUDIENCES = {
  ro: "people in Romania",
  en: "English-speaking players (mainly the USA and the UK)",
  de: "players in Germany, Austria and Switzerland",
  fr: "players in France",
  es: "players in Spain and Latin America",
  it: "players in Italy",
  hu: "players in Hungary",
  pl: "players in Poland",
  pt: "players in Portugal and Brazil",
  nl: "players in the Netherlands and Belgium",
  tr: "players in Turkey"
};
export const audienceFor = code => AUDIENCES[code] ?? `${languageName(code)}-speaking players`;

/** The prompt sent to the model. `existing` is the full current list of the category (so it does not repeat itself). */
export function buildPrompt({ category, lang, count, existing, sample }) {
  const language = languageName(lang);
  const phrases = PHRASE_CATEGORIES.includes(category);
  const extra = lang === "ro" ? "Use correct Romanian diacritics with comma-below (ș, ț), never the cedilla forms (ş, ţ)." : `Use the correct spelling and diacritics of ${language}.`;
  return [
    `You are helping build word lists for a party game (like Spyfall / "Intrus"). Players all get the same secret word except one intruder who gets none and must bluff.`,
    `Write ${count} NEW ${language} words or short phrases for the category "${category}".${lang === "ro" ? "" : " (The category name is in Romanian: use its meaning, and write every word in " + language + ".)"}`,
    ``,
    `Good words:`,
    `- concrete and instantly recognisable by most adults who speak ${language}, not too obscure and not too generic`,
    phrases ? `- a whole saying, expression or situation, at most 10 words, that people instantly recognise` : `- one word, or a short phrase of at most 4 words`,
    `- specific enough to describe and to bluff about (e.g. "ambulanță", not "vehicul")`,
    `- family friendly (PG-13): nothing sexual, hateful, political-extremist, or about drugs`,
    `- written in lower case, except proper nouns (names, places, titles) which keep their capitals`,
    `- ${extra}`,
    ``,
    `The audience is ${audienceFor(lang)}. Choose words that THIS audience knows from its own everyday life and culture.`,
    lang === "ro"
      ? `Match the style and difficulty of these examples from the same category:`
      : `Do NOT translate. These examples come from the Romanian version of the game and only show the style and difficulty to aim for. For categories about people, TV, films, music, food, traditions, places or politics, pick things that are famous for the audience above (for example, for celebrities pick people that ${languageName(lang)} speakers know, not Romanian ones):`,
    sample.map(w => `- ${w}`).join("\n"),
    ``,
    existing.length ? `Do NOT repeat or closely paraphrase any word from this existing list:` : ``,
    existing.join(", "),
    ``,
    `Answer with ONLY a JSON array of strings, no explanation, no code fences.`
  ].join("\n");
}

/** Pulls the JSON array out of the model's reply (tolerates code fences and text around it). */
export function parseModelReply(text) {
  const s = String(text ?? "");
  const a = s.indexOf("[");
  const b = s.lastIndexOf("]");
  if (a < 0 || b <= a) throw new Error("The reply has no JSON array.");
  const arr = JSON.parse(s.slice(a, b + 1));
  if (!Array.isArray(arr)) throw new Error("The reply is not an array.");
  return arr.filter(x => typeof x === "string");
}

/**
 * Categories whose words belong to ONE culture: another language gets its own local words (generate / wikidata).
 * Every other category is universal (animals, food, objects...): another language gets the SAME concepts, translated.
 */
export const LOCAL_CATEGORIES = [
  "Politicieni", "Personalități", "Muzică românească", "Filme și seriale românești", "Mâncare tradițională", "Locuri din România",
  "Proverbe și expresii", "București", "Anii '90", "Eurovision", "Crăciun", "Sărbători", "Tradiții și datini", "Paște și Halloween",
  "Basme", "Filme și desene", "Petrecere"
];
export const isLocalCategory = name => LOCAL_CATEGORIES.includes(name);

/** Prompt that translates the Romanian list one to one, so every language plays with the same animals / foods / objects. */
export function buildTranslatePrompt({ category, lang, words }) {
  const language = languageName(lang);
  return [
    `You are helping translate word lists for a party game. Players all get the same secret word except one intruder who must bluff.`,
    `Translate each Romanian word of the category "${category}" into ${language}.`,
    ``,
    `Rules:`,
    `- keep the SAME concept (the same animal, food, object...), never swap it for a different one`,
    `- use the most common everyday ${language} word, ideally one word (a short phrase only if that is how people say it)`,
    `- lower case, except proper nouns`,
    `- if there is no natural ${language} equivalent, use null for that item`,
    `- ${lang === "ro" ? "" : `use the correct spelling and diacritics of ${language}`}`,
    ``,
    `Romanian words (numbered):`,
    words.map((w, i) => `${i + 1}. ${w}`).join("\n"),
    ``,
    `Answer with ONLY a JSON array of exactly ${words.length} items (a string or null), in the same order, no explanation, no code fences.`
  ].join("\n");
}

/** Reply -> [{ ro, tr }] for the items that got a translation. Throws when the length does not match. */
export function parseTranslation(text, words) {
  const s = String(text ?? "");
  const a = s.indexOf("[");
  const b = s.lastIndexOf("]");
  if (a < 0 || b <= a) throw new Error("The reply has no JSON array.");
  const arr = JSON.parse(s.slice(a, b + 1));
  if (!Array.isArray(arr) || arr.length !== words.length) {
    throw new Error(`Expected ${words.length} items in the same order, got ${Array.isArray(arr) ? arr.length : "no array"}.`);
  }
  return words.map((ro, i) => ({ ro, tr: typeof arr[i] === "string" ? arr[i] : null })).filter(x => x.tr);
}

/** index.ts -> { newInV2: [names], optional: [names] } (the categories the tests protect from duplicates). */
export function parseProtected(indexSource) {
  const v2 = /NEW_IN_V2:\s*string\[\]\s*=\s*\[([^\]]*)\]/.exec(indexSource);
  const opt = /OPTIONAL_PACKS:\s*Record<string,\s*string>\s*=\s*\{([^}]*)\}/.exec(indexSource);
  const names = (txt, re) => [...(txt ?? "").matchAll(re)].map(m => m[1]);
  return { newInV2: names(v2?.[1], /"([^"]+)"/g), optional: names(opt?.[1], /"([^"]+)":/g) };
}

/** The review file: header lines start with #, then one word per line. */
export function renderPending({ category, lang, words }) {
  return [
    `# category: ${category}`,
    `# lang: ${lang}`,
    `# Review: delete the lines you do not want (or fix a spelling), save, then run: pnpm words:apply`,
    `# Lines starting with # are ignored.`,
    ...words.map(w => (typeof w === "string" ? w : w.note ? `${w.word}  # ${w.note}` : w.word)),
    ""
  ].join("\n");
}

export function parsePending(text) {
  const meta = {};
  const words = [];
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = /^#\s*(category|lang):\s*(.+)$/.exec(t);
    if (m) {
      meta[m[1]] = m[2].trim();
    }
    else if (!t.startsWith("#")) {
      // A review line may carry a note after two spaces and "# " (the Wikidata source writes how famous the person is).
      words.push(t.replace(/\s{2,}#\s.*$/, "").trim());
    }
  }
  return { category: meta.category, lang: meta.lang ?? "ro", words };
}

/** Appends words to the array of a list source file, keeping its style (2 spaces, double quotes, trailing commas). */
export function appendWords(fileSource, words) {
  const end = fileSource.indexOf("\n];");
  if (end < 0) throw new Error("Could not find the end of the list (a line with `];`).");
  let head = fileSource.slice(0, end).replace(/\s+$/, "");
  if (!head.endsWith(",") && !head.endsWith("[")) head += ",";
  return head + "\n" + words.map(w => `  ${JSON.stringify(w)},`).join("\n") + fileSource.slice(end);
}

/** A brand new list file (used for languages that have no file yet). */
export function newListFile(exportName, words, comment = "") {
  return `${comment ? `/** ${comment} */\n` : ""}export const ${exportName}: string[] = [\n${words.map(w => `  ${JSON.stringify(w)},`).join("\n")}\n];\n`;
}

/** Sets `"Name": N` in counts.ts. Returns the new source, or null when the category has no line there. */
export function setCount(countsSource, name, n) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`("${esc}":\\s*)(\\d+)`);
  return re.test(countsSource) ? countsSource.replace(re, `$1${n}`) : null;
}
