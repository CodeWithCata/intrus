/**
 * Wikidata word source: real "who is famous to this audience" data instead of a model's guess. No key, no cost.
 *
 * A person / work is a candidate when it
 *   - has an article on the Wikipedia of the audience's language (people who speak the language know it exists),
 *   - passes the category's preset (occupation or kind of work, alive or not, country),
 *   - and is ranked by fame: the number of languages that have an article (wikibase:sitelinks), or, with --views,
 *     the Wikipedia page views of the last 12 months in that language.
 * The pure parts (buildQuery, parseBindings, rank, titleFromUrl) are tested in tests/unit/words-tool.test.ts; only fetchCandidates and
 * pageViews touch the network. The Q-numbers below are Wikidata item ids (check any of them at wikidata.org/wiki/Q177220).
 */

export const COUNTRIES = { RO: "Q218", US: "Q30", GB: "Q145", DE: "Q183", FR: "Q142", ES: "Q29", IT: "Q38", HU: "Q28", PL: "Q36", PT: "Q45", NL: "Q55", TR: "Q43" };

const OCC = {
  actor: "Q33999", filmActor: "Q10800557", tvActor: "Q10798782", singer: "Q177220", singerSongwriter: "Q488205", musician: "Q639669", rapper: "Q2252262",
  composer: "Q36834", dj: "Q130857", tvPresenter: "Q947873", comedian: "Q245068", model: "Q4610556", footballer: "Q937857", tennis: "Q10833314",
  basketball: "Q3665646", boxer: "Q11338576", f1: "Q10841764", director: "Q2526255", politician: "Q82955", youtuber: "Q17125263"
};
const CELEB = [OCC.actor, OCC.filmActor, OCC.tvActor, OCC.singer, OCC.singerSongwriter, OCC.rapper, OCC.tvPresenter, OCC.comedian, OCC.model, OCC.footballer, OCC.tennis, OCC.basketball, OCC.boxer, OCC.f1, OCC.director, OCC.youtuber];
const MUSIC = [OCC.singer, OCC.singerSongwriter, OCC.musician, OCC.rapper, OCC.composer, OCC.dj];

/**
 * Presets per category name (the names of index.ts).
 *   kind: "person" | "work";  occ / cls: Q-numbers;  alive: true = living people only;
 *   country: "audience" (Romania for ro, no filter otherwise), a code like "RO" (only that country), or omitted (no filter);
 *   minLinks: { local, global } the minimum number of language editions (small for a local country, bigger worldwide).
 */
/** @typedef {{ kind: "person" | "work", occ?: string[], cls?: string[], alive?: boolean, country?: string, minLinks?: { local: number, global: number } }} Preset */

/** @type {Record<string, Preset>} */
export const PRESETS = {
  "Personalități": { kind: "person", occ: CELEB, alive: true, country: "audience", minLinks: { local: 6, global: 40 } },
  "Politicieni": { kind: "person", occ: [OCC.politician], alive: true, country: "audience", minLinks: { local: 5, global: 40 } },
  "Muzică românească": { kind: "person", occ: MUSIC, alive: true, country: "RO", minLinks: { local: 5, global: 5 } },
  "Filme și seriale românești": { kind: "work", cls: ["Q11424", "Q5398426"], country: "RO", minLinks: { local: 5, global: 5 } },
  "Filme și desene": { kind: "work", cls: ["Q11424", "Q5398426", "Q202866"], minLinks: { local: 30, global: 30 } }
};

const isQ = q => /^Q\d+$/.test(q);

/**
 * The SPARQL text. All inputs are validated, so nothing from the command line can alter the query's shape.
 * @param {{ preset: Preset, lang: string, countries?: string[], minLinks: number, limit?: number }} options
 */
export function buildQuery({ preset, lang, countries = [], minLinks, limit = 300 }) {
  if (!/^[a-z]{2,3}(-[a-z]+)?$/.test(lang)) throw new Error(`Bad language code "${lang}".`);
  const ids = [...(preset.kind === "work" ? preset.cls : preset.occ), ...countries];
  if (!ids.every(isQ)) throw new Error("Bad Wikidata id in the preset.");
  const values = list => list.map(q => `wd:${q}`).join(" ");
  const L = [];
  if (preset.kind === "work") {
    L.push(`?item wdt:P31 ?cls . VALUES ?cls { ${values(preset.cls)} } .`);
    if (countries.length) L.push(`?item wdt:P495 ?c . VALUES ?c { ${values(countries)} } .`);
  }
  else {
    L.push(`?item wdt:P31 wd:Q5 . ?item wdt:P106 ?occ . VALUES ?occ { ${values(preset.occ)} } .`);
    if (countries.length) L.push(`?item wdt:P27 ?c . VALUES ?c { ${values(countries)} } .`);
    if (preset.alive) L.push(`FILTER NOT EXISTS { ?item wdt:P570 ?died } .`);
  }
  L.push(`?item wikibase:sitelinks ?links . FILTER(?links >= ${Math.max(1, Math.floor(Number(minLinks) || 1))}) .`);
  L.push(`?article schema:about ?item ; schema:isPartOf <https://${lang}.wikipedia.org/> .`);
  L.push(`?item rdfs:label ?label . FILTER(LANG(?label) = "${lang}") .`);
  return `SELECT DISTINCT ?item ?label ?links ?article WHERE {\n  ${L.join("\n  ")}\n}\nORDER BY DESC(?links)\nLIMIT ${Math.max(1, Math.floor(limit))}`;
}

/** Wikidata JSON -> [{ id, label, links, title }], one per item, in the order received (already by fame). */
export function parseBindings(json) {
  const seen = new Set();
  const out = [];
  for (const b of json?.results?.bindings ?? []) {
    const id = b.item?.value?.split("/").pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: b.label?.value ?? "", links: Number(b.links?.value) || 0, title: titleFromUrl(b.article?.value ?? "") });
  }
  return out;
}

/** "https://ro.wikipedia.org/wiki/Mihaela_R%C4%83dulescu" -> "Mihaela_Rădulescu" */
export function titleFromUrl(url) {
  const tail = String(url).split("/wiki/")[1];
  if (!tail) return "";
  try {
    return decodeURIComponent(tail);
  }
  catch {
    return tail;
  }
}

/**
 * Order by page views (when known), then by number of languages.
 * @param {{ id: string, links: number }[]} items
 * @param {Map<string, number> | null} [views]
 */
export function rank(items, views = null) {
  return [...items].sort((a, b) => (views ? (views.get(b.id) ?? 0) - (views.get(a.id) ?? 0) : 0) || b.links - a.links);
}

export const noteFor = (item, views) => `${item.links} languages${views?.has(item.id) ? `, ${Intl.NumberFormat("en").format(views.get(item.id))} views/year` : ""}`;

const UA = "intrus-word-tool/1.0 (https://github.com/CodeWithCata/intrus)";

export async function fetchCandidates(query, fetchFn = fetch) {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetchFn(url, { headers: { accept: "application/sparql-results+json", "user-agent": UA }, signal: AbortSignal.timeout(70000) });
  if (res.status === 429) throw new Error("Wikidata says too many requests: wait a minute and try again.");
  if (!res.ok) throw new Error(`Wikidata error ${res.status}: ${(await res.text()).slice(0, 200)}. If it timed out, lower --limit or raise --min-links.`);
  return parseBindings(await res.json());
}

/** Wikipedia page views of the last 12 whole months in `lang`, for the first `n` items (5 requests at a time). Failures count as 0. */
export async function pageViews(items, lang, n = 120, fetchFn = fetch, now = new Date()) {
  const pad = x => String(x).padStart(2, "0");
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 12, 1));
  const stamp = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}0100`;
  const views = new Map();
  const todo = items.slice(0, n).filter(i => i.title);
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(todo.slice(i, i + 5).map(async it => {
      try {
        const u = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(it.title)}/monthly/${stamp(start)}/${stamp(end)}`;
        const r = await fetchFn(u, { headers: { "user-agent": UA } });
        const j = r.ok ? await r.json() : null;
        views.set(it.id, (j?.items ?? []).reduce((s, x) => s + (x.views || 0), 0));
      }
      catch {
        views.set(it.id, 0);
      }
    }));
  }
  return views;
}

/**
 * The countries to filter by: --country wins, else the preset (Romania for local categories). Returns { codes, qids, local }.
 * @param {{ preset: Preset, lang: string, country?: string }} options
 */
export function resolveCountries({ preset, lang, country }) {
  let codes = [];
  if (country) codes = String(country).split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
  else if (preset.country === "audience") codes = lang === "ro" ? ["RO"] : [];
  else if (preset.country) codes = [preset.country];
  const bad = codes.filter(c => !COUNTRIES[c]);
  if (bad.length) throw new Error(`Unknown country code(s): ${bad.join(", ")}. Known: ${Object.keys(COUNTRIES).join(", ")}`);
  if (preset.country && preset.country !== "audience" && !country && lang !== "ro") {
    throw new Error(`This category is specific to ${preset.country}. For another country use --country <code>, for example --country ${lang === "en" ? "US,GB" : "DE"}.`);
  }
  return { codes, qids: codes.map(c => COUNTRIES[c]), local: codes.length > 0 };
}
