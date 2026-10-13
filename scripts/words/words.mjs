/**
 * Word tool: generate new words ahead of time, review them in a text file, then add them to the lists.
 *
 *   pnpm words:generate --cat "Animale" --count 30        ask the model for 30 new words, writes a review file
 *   pnpm words:generate --all --count 20                  the same for every category
 *   pnpm words:generate --cat "Animale" --lang en         another language (see the note on languages in README.md)
 *   pnpm words:wikidata --cat "Personalități" --lang en   real fame data from Wikidata (no key): people / works people know
 *   pnpm words:status --to 100                           how many words each category has and how many are missing
 *   add --to 100 to generate / wikidata (ask for exactly what is missing) and to apply (never go above 100)
 *   pnpm words:apply                                      add every reviewed file in scripts/words/pending to the lists
 *   pnpm words:check                                      check every list against the same rules the tests use
 *
 * No key? Three ways, see README.md: --prompt-only (paste the prompt into any chat), --reply <file> (import that chat's answer),
 * or a free Google Gemini key (GEMINI_API_KEY). With a key from console.anthropic.com use ANTHROPIC_API_KEY. Model: WORDS_MODEL.
 * Nothing is ever written into the game without you reading it first: generate only writes into scripts/words/pending/.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES, PRESETS, buildQuery, fetchCandidates, noteFor, pageViews, rank, resolveCountries } from "./wikidata.mjs";
import { appendWords, buildPrompt, buildTranslatePrompt, cleanWord, isLocalCategory, filterCandidates, maxWordsFor, newListFile, parseCategories, parseModelReply, parsePending, parseTranslation, parseProtected, parseWords, renderPending, setCount, wordProblem } from "./lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORDS = join(ROOT, "src/lib/data/words");
const PENDING = join(ROOT, "scripts/words/pending");
const MODEL = process.env.WORDS_MODEL || "claude-sonnet-5-5";

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--") continue;
    if (t.startsWith("--")) {
      const k = t.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) a[k] = true;
      else {
        a[k] = next;
        i++;
      }
    }
    else a._.push(t);
  }
  return a;
}

const categories = () => parseCategories(readFileSync(join(WORDS, "index.ts"), "utf8"));
const listPath = (c, lang) => (lang === "ro" ? join(WORDS, `${c.file}.ts`) : join(WORDS, lang, `${c.file}.ts`));
const readList = (c, lang) => (existsSync(listPath(c, lang)) ? parseWords(readFileSync(listPath(c, lang), "utf8")) : []);

/** Every word that exists in any category of this language (lower-cased): a new word may not repeat any of them. */
function allTaken(lang) {
  const set = new Set();
  for (const c of categories()) for (const w of readList(c, lang)) set.add(w.toLowerCase());
  return set;
}

function pick(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

async function ask(prompt) {
  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] })
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return (data.content ?? []).map(b => (b.type === "text" ? b.text : "")).join("");
  }
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.WORDS_MODEL || "gemini-2.0-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? "").join("");
  }
  throw new Error("No API key. Use --prompt-only and paste the prompt into any chat (see README.md), or set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY.");
}

async function generate(args) {
  const lang = String(args.lang || "ro");
  const target = Number(args.to) || 0;
  const cats = categories();
  if (args.reply && args.all) {
    console.error("--reply works with one category at a time: use --cat \"<name>\".");
    process.exit(1);
  }
  const chosen = args.all ? cats : cats.filter(c => c.name.toLowerCase() === String(args.cat ?? "").toLowerCase());
  if (!chosen.length) {
    console.error(`Pick a category with --cat "<name>" or use --all. Categories:\n  ${cats.map(c => c.name).join("\n  ")}`);
    process.exit(1);
  }
  mkdirSync(join(PENDING, lang), { recursive: true });
  for (const c of chosen) {
    const existing = readList(c, lang);
    const count = target ? target - existing.length : Math.max(1, Math.min(100, Number(args.count) || 30));
    if (count <= 0) {
      console.log(`${c.name} (${lang}): already has ${existing.length}, nothing to add for ${target}.`);
      continue;
    }
    // Universal categories (animals, food...) get the SAME concepts in every language: the Romanian list is translated.
    // Local ones (celebrities, traditions...) get their own words for that audience. --mode translate|local overrides.
    const mode = lang === "ro" ? "new" : String(args.mode || (isLocalCategory(c.name) ? "local" : "translate"));
    const source = readList(c, "ro");
    if (mode === "translate" && !source.length) {
      console.log(`${c.name}: no Romanian words to translate.`);
      continue;
    }
    // Local mode in another language starts from the Romanian list as the example of style when it has no words yet (the prompt says: do not translate).
    const reference = existing.length ? existing : source;
    const taken = allTaken(lang);
    const prompt = mode === "translate"
      ? buildTranslatePrompt({ category: c.name, lang, words: source })
      : buildPrompt({ category: c.name, lang, count: count + Math.max(10, Math.ceil(count * 0.3)), existing, sample: pick(reference, 25) });
    if (args["prompt-only"]) {
      mkdirSync(join(PENDING, "_prompts", lang), { recursive: true });
      const pf = join(PENDING, "_prompts", lang, `${c.file}.prompt.txt`);
      writeFileSync(pf, prompt);
      console.log(`${c.name} (${lang}, ${mode}): prompt written to ${pf}`);
      continue;
    }
    console.log(`\n${c.name} (${lang}, ${mode}): ${args.reply ? "reading the reply file" : mode === "translate" ? `translating ${source.length} words` : `asking for ${count} new words (plus spares)`}...`);
    let candidates;
    const from = new Map();
    try {
      const reply = args.reply ? readFileSync(resolve(String(args.reply)), "utf8") : await ask(prompt);
      if (mode === "translate") {
        const pairs = parseTranslation(reply, source);
        pairs.forEach(x => from.set(cleanWord(x.tr).toLowerCase(), x.ro));
        candidates = pairs.map(x => x.tr);
      }
      else candidates = parseModelReply(reply);
    }
    catch (e) {
      console.error(`  failed: ${e.message}`);
      continue;
    }
    const { ok, rejected } = filterCandidates(candidates, taken, count, maxWordsFor(c.name));
    const file = join(PENDING, lang, `${c.file}.txt`);
    writeFileSync(file, renderPending({ category: c.name, lang, words: ok.map(w => ({ word: w, note: from.has(w.toLowerCase()) ? `from: ${from.get(w.toLowerCase())}` : "" })) }));
    if (target && ok.length < count) console.log(`  SHORT: ${ok.length} of ${count} needed, run the command again for the rest.`);
    console.log(`  ${ok.length} words kept, ${rejected.length} rejected${rejected.length ? ` (${rejected.slice(0, 5).map(r => `${r.word}: ${r.why}`).join("; ")}${rejected.length > 5 ? "; ..." : ""})` : ""}`);
    console.log(`  review: ${file}`);
  }
  if (args["prompt-only"]) console.log("\nNext: paste a prompt file into any AI chat, save its answer to a file, then run: pnpm words:generate --cat \"<name>\" --lang <code> --reply <that file>");
  else console.log("\nNext: open the files above, delete any line you do not want, save, then run: pnpm words:apply");
}

function status(args) {
  const lang = String(args.lang || "ro");
  const target = Number(args.to) || 100;
  let missing = 0;
  console.log(`Words per category in "${lang}", target ${target}:\n`);
  for (const c of categories()) {
    const n = readList(c, lang).length;
    const short = Math.max(0, target - n);
    missing += short;
    const src = PRESETS[c.name] ? "wikidata or generate" : "generate";
    console.log(`${String(n).padStart(4)}  ${short ? `need ${String(short).padStart(3)}` : n === target ? "  ok    " : `over +${n - target}`}  ${c.name}  (${src})`);
  }
  console.log(`\n${missing} words missing in total.`);
}

async function wikidata(args) {
  const lang = String(args.lang || "ro");
  const cats = categories();
  const c = cats.find(x => x.name.toLowerCase() === String(args.cat ?? "").toLowerCase());
  const preset = c && PRESETS[c.name];
  const target = Number(args.to) || 0;
  const count = target ? target - (c ? readList(c, lang).length : 0) : Math.max(1, Math.min(200, Number(args.count) || 40));
  if (c && count <= 0) {
    console.log(`${c.name} (${lang}): already has ${target} or more, nothing to add.`);
    return;
  }
  if (!preset) {
    console.error(`Wikidata works for people and works, not for every category. Use --cat with one of:\n  ${Object.keys(PRESETS).join("\n  ")}`);
    process.exit(1);
  }
  const { codes, qids, local } = resolveCountries({ preset, lang, country: args.country });
  const minLinks = Number(args["min-links"]) || (local ? preset.minLinks.local : preset.minLinks.global);
  const limit = Math.max(count * 4, 200);
  console.log(`${c.name} (${lang}${codes.length ? ", " + codes.join("/") : ", worldwide"}): asking Wikidata (people/works with a ${lang}.wikipedia article, at least ${minLinks} languages)...`);
  const query = buildQuery({ preset, lang, countries: qids, minLinks, limit });
  if (args["show-query"]) console.log(query);
  let items = await fetchCandidates(query);
  console.log(`  ${items.length} candidates from Wikidata`);
  let views = null;
  if (args.views) {
    console.log("  reading Wikipedia page views of the last 12 months (top 120)...");
    views = await pageViews(items, lang);
    items = rank(items, views);
  }
  const byLabel = new Map(items.map(i => [i.label.toLowerCase(), i]));
  const { ok, rejected } = filterCandidates(items.map(i => i.label), allTaken(lang), count, maxWordsFor(c.name));
  const lines = ok.map(w => ({ word: w, note: noteFor(byLabel.get(w.toLowerCase()) ?? { links: 0, id: "" }, views) }));
  mkdirSync(join(PENDING, lang), { recursive: true });
  const file = join(PENDING, lang, `${c.file}.txt`);
  writeFileSync(file, renderPending({ category: c.name, lang, words: lines }));
  if (target && ok.length < count) console.log(`  SHORT: ${ok.length} of ${count} needed. Lower --min-links to go deeper, or fill the rest with: pnpm words:generate --cat "${c.name}" --to ${target}`);
  const skipped = rejected.filter(r => r.why !== "over the requested count");
  console.log(`  ${ok.length} kept${skipped.length ? `, ${skipped.length} skipped (${skipped.slice(0, 5).map(r => `${r.word}: ${r.why}`).join("; ")}${skipped.length > 5 ? "; ..." : ""})` : ""}`);
  console.log(`  review: ${file}\n\nThe note after each name (# 85 languages) is only for you; it is ignored when you apply. Delete the lines you do not want, then run: pnpm words:apply`);
  void COUNTRIES;
}

function apply(args) {
  const dry = !!args.dry;
  if (!existsSync(PENDING)) {
    console.log("Nothing to apply: scripts/words/pending does not exist yet. Run pnpm words:generate first.");
    return;
  }
  const files = [];
  for (const lang of readdirSync(PENDING, { withFileTypes: true })) {
    if (!lang.isDirectory() || lang.name.startsWith("_")) continue;
    for (const f of readdirSync(join(PENDING, lang.name))) if (f.endsWith(".txt")) files.push(join(PENDING, lang.name, f));
  }
  if (!files.length) {
    console.log("Nothing to apply: no review files in scripts/words/pending.");
    return;
  }
  const cats = categories();
  let countsSource = readFileSync(join(WORDS, "counts.ts"), "utf8");
  let countsChanged = false;
  for (const file of files) {
    const p = parsePending(readFileSync(file, "utf8"));
    const c = cats.find(x => x.name === p.category);
    if (!c) {
      console.error(`${file}: unknown category "${p.category}", skipped.`);
      continue;
    }
    // Check again against the lists as they are now: something may have been added since the file was generated.
    const have = readList(c, p.lang).length;
    const room = args.to ? Number(args.to) - have : Infinity;
    const { ok, rejected } = filterCandidates(p.words, allTaken(p.lang), room > 0 ? room : 0, maxWordsFor(c.name));
    if (args.to && rejected.some(r => r.why === "over the requested count")) console.log(`${c.name}: capped at ${args.to}, left out ${rejected.filter(r => r.why === "over the requested count").map(r => r.word).join(", ")}`);
    const dropped = rejected.filter(r => r.why !== "over the requested count");
    if (dropped.length) console.log(`${c.name}: skipped ${dropped.map(r => `${r.word} (${r.why})`).join(", ")}`);
    if (args.to && have + ok.length < Number(args.to)) console.log(`${c.name}: ${have + ok.length} of ${args.to}, still ${Number(args.to) - have - ok.length} short.`);
    if (!ok.length) {
      console.log(`${c.name} (${p.lang}): no new words in ${file}`);
      continue;
    }
    const target = listPath(c, p.lang);
    if (p.lang === "ro") {
      const before = readList(c, "ro").length;
      const next = appendWords(readFileSync(target, "utf8"), ok);
      if (!dry) writeFileSync(target, next);
      const total = before + ok.length;
      const c2 = setCount(countsSource, c.name, total);
      if (c2 !== null) {
        countsSource = c2;
        countsChanged = true;
      }
      console.log(`${c.name}: +${ok.length} words (now ${total})${dry ? " [dry run]" : ""}`);
    }
    else {
      const all = [...readList(c, p.lang), ...ok];
      if (!dry) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, newListFile(c.exportName, all, `${c.name} words in ${p.lang}. Written by pnpm words:apply; the app finds this folder by itself.`));
      }
      console.log(`${c.name} (${p.lang}): +${ok.length} words written to ${target}${dry ? " [dry run]" : ""}`);
    }
    if (!dry) {
      const done = join(PENDING, "_applied");
      mkdirSync(done, { recursive: true });
      renameSync(file, join(done, `${Date.now()}-${p.lang}-${c.file}.txt`));
    }
  }
  if (countsChanged && !dry) writeFileSync(join(WORDS, "counts.ts"), countsSource);
  console.log(dry ? "\nDry run: nothing was changed." : "\nDone. Run `pnpm test` to confirm, then commit the changed files.");
}

function check() {
  const cats = categories();
  const { newInV2, optional } = parseProtected(readFileSync(join(WORDS, "index.ts"), "utf8"));
  const protectedCats = new Set([...newInV2, ...optional]);
  const owner = new Map();
  let bad = 0;
  let total = 0;
  for (const c of cats) {
    const own = new Set();
    for (const w of readList(c, "ro")) {
      total++;
      const problem = wordProblem(cleanWord(w), maxWordsFor(c.name)) || (cleanWord(w) !== w ? "needs cleaning (spaces or cedilla)" : null);
      if (problem) {
        console.log(`${c.name}: "${w}": ${problem}`);
        bad++;
      }
      const k = w.toLowerCase();
      if (own.has(k)) {
        console.log(`"${w}" is twice in ${c.name}`);
        bad++;
      }
      own.add(k);
      // Same rule as tests/unit/wordpacks.test.ts: older categories may share words, but a v2 / optional pack may not repeat any other list.
      const prev = owner.get(k);
      if (prev !== undefined && prev !== c.name && (protectedCats.has(c.name) || protectedCats.has(prev))) {
        console.log(`"${w}" is in both ${prev} and ${c.name}`);
        bad++;
      }
      if (prev === undefined) owner.set(k, c.name);
    }
  }
  console.log(bad ? `\n${bad} problem(s).` : `All ${total} words in ${cats.length} categories pass.`);
  process.exitCode = bad ? 1 : 0;
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
if (cmd === "generate") await generate(args);
else if (cmd === "wikidata") await wikidata(args);
else if (cmd === "status") status(args);
else if (cmd === "apply") apply(args);
else if (cmd === "check") check();
else console.log("Usage: node scripts/words/words.mjs generate|wikidata|apply|status|check   (see the header of this file)");
