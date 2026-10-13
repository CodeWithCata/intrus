/** Host settings, custom words, and picking the round word (pickWord).  (see room-logic.ts) */
import { type PoolPair, pickTwin } from "../src/lib/game/twins.ts";
import { CATEGORY_MAX, CUSTOM_MAX, HINTS, HINT_MAX, MAX_NAME, MAX_USED, MINUTES, RoomError, WORD_MAX, cleanText, isString, markHostAction, requireHost } from "./room-core.ts";
import { type Lang, type Room, type Settings, type WordPack } from "./types.ts";

/* ---------------- settings and words ---------------- */

/** One custom entry as the host typed it: "word", "word|category" or "word|category|hint" (the same format the local game saves). */
export interface CustomEntry {
  w: string;
  c: string;
  h: string;
}

/** A part of a custom entry, cleaned like any display text, and without the separator. */
const part = (raw: unknown, max: number): string => cleanText(cleanText(raw, max * 2).replace(/\|/g, " "), max);

export function parseCustom(entries: readonly string[]): CustomEntry[] {
  const out: CustomEntry[] = [];
  for (const raw of entries) {
    const [w, c, h] = raw.split("|");
    const word = part(w, WORD_MAX);
    if (word) out.push({ w: word, c: part(c, CATEGORY_MAX), h: part(h, HINT_MAX) });
  }
  return out;
}

const formatCustom = (e: CustomEntry): string => e.w + (e.c || e.h ? "|" + e.c : "") + (e.h ? "|" + e.h : "");

/** Cleans the host's list. The same word may appear in two categories, but not twice in the same one. */
export function cleanWords(list: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const raw = (Array.isArray(list) ? list : []).map((x) => (isString(x) ? x : x == null ? "" : String(x)));
  for (const e of parseCustom(raw)) {
    const key = (e.w + "|" + e.c).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(formatCustom(e));
    if (out.length >= CUSTOM_MAX) break;
  }
  return out;
}

/** Whitelists every field: the host is trusted to run the game, not to send arbitrary data. */
export function updateSettings(room: Room, hostId: string, raw: unknown, packs: readonly WordPack[]): Room {
  requireHost(room, hostId);
  if (room.phase !== "lobby") throw new RoomError("in-progress", "Can't change settings mid-round.");
  const r: Record<string, unknown> = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (Array.isArray(r.customWords)) room.customWords = cleanWords(r.customWords);
  const ids = new Set(packs.map((p) => p.id));
  const cats = Array.isArray(r.cats) ? r.cats.filter((c): c is string => isString(c) && ids.has(c)) : [...ids];
  // The host's own words are always part of the pool. With no category picked they are the pool; with nothing at all, every category is.
  const chosen = cats.length ? cats : room.customWords.length ? [] : [...ids];
  const settings: Settings = {
    cats: chosen,
    imposters: typeof r.imposters === "number" && Number.isInteger(r.imposters) ? Math.max(1, r.imposters) : 1,
    minutes: typeof r.minutes === "number" && MINUTES.includes(r.minutes) ? r.minutes : 3,
    hint: HINTS.find((h) => h === r.hint) ?? "category",
    lang: r.lang === "ro" ? "ro" : "en",
    customName: cleanText(r.customName, MAX_NAME),
    tw: r.tw === true,
    qm: r.qm === true,
    troll: r.troll === true,
    twn: r.twn === true,
    kn: r.kn === true,
    // On unless the host explicitly turned it off: a client that does not know this switch keeps the wheel.
    wh: r.wh !== false
  };
  room.settings = settings;
  markHostAction(room);
  return room;
}

interface Candidate {
  word: string;
  category: string;
  /** The other words of the same category (the decoy and the double agent's word come from here). */
  related: string[];
  key: string;
  hint: string;
}

/**
 * Picks the round's word on the server, so no device (not even the host's) knows it early. Avoids recently
 * dealt words while the pool allows. The pool is the chosen categories plus the host's own words (each with its own
 * category and hint when it has them). With twin words on (Romanian only) the word comes from a pair instead.
 * Pure: it does NOT touch the room. The caller commits `used` once the whole start has been validated.
 */
export function pickWord(
  room: Room, packs: readonly WordPack[], rng: () => number = Math.random
): { word: string; category: string; decoy: string; used: string[]; related: string[]; twin: string | null; customHint: string | null } | null {
  const s = room.settings;
  const lang: Lang = s?.lang === "ro" ? "ro" : "en";
  const cats = s?.cats ?? null;
  const pool: Candidate[] = [];
  for (const p of packs) {
    if (cats && !cats.includes(p.id)) continue;
    for (const w of p.words[lang]) pool.push({ word: w, category: p.name[lang], related: p.words[lang], key: lang + ":" + p.id + ":" + w, hint: "" });
  }
  const custom = parseCustom(room.customWords);
  const fallback = s?.customName || (lang === "ro" ? "Cuvintele mele" : "My words");
  const resolved = custom.map((e) => {
    const pack = e.c ? packs.find((p) => p.name[lang].toLowerCase() === e.c.toLowerCase()) : undefined;
    return { e, pack, category: pack ? pack.name[lang] : e.c || fallback };
  });
  for (const { e, pack, category } of resolved) {
    const related = pack ? pack.words[lang] : resolved.filter((x) => !x.pack && x.category.toLowerCase() === category.toLowerCase()).map((x) => x.e.w);
    pool.push({ word: e.w, category, related, key: lang + ":custom:" + category + ":" + e.w, hint: e.h });
  }
  if (!pool.length) return null;
  const used = new Set(room.used);
  let fresh = pool.filter((x) => !used.has(x.key));
  if (!fresh.length) {
    pool.forEach((x) => used.delete(x.key));
    fresh = pool;
  }
  let c: Candidate = fresh[Math.floor(rng() * fresh.length)];
  let twin: string | null = null;
  if (s?.twn && lang === "ro") {
    // "Cuvinte gemene": the civilians get word A of a pair, the intruders the similar word B.
    const recent = [...used].slice(-30).map((k) => k.split(":").slice(2).join(":"));
    const pairPool: PoolPair[] = packs.filter((p) => (!cats || cats.includes(p.id)) && p.pairs?.length).flatMap((p) => (p.pairs ?? []).map(([a, b]) => ({ a, b, cat: p.id })));
    const tw = pickTwin(pairPool, rng, recent);
    const pack = tw ? packs.find((p) => p.id === tw.cat) : undefined;
    if (tw && pack) {
      c = { word: tw.a, category: pack.name[lang], related: pack.words[lang], key: lang + ":" + pack.id + ":" + tw.a, hint: "" };
      twin = tw.b;
    }
  }
  used.delete(c.key);
  used.add(c.key);
  const others = c.related.filter((w) => w !== c.word);
  return {
    word: c.word,
    category: c.category,
    decoy: others.length ? others[Math.floor(rng() * others.length)] : "",
    used: [...used].slice(-MAX_USED),
    related: others,
    twin,
    customHint: c.hint || null
  };
}
