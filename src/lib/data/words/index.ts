/**
 * Word categories. Every category lives in its own file and is loaded with a dynamic import(), so
 * the ~25 lists are separate chunks that stay out of the initial bundle.
 *
 *  - CATEGORIES: the category names (cheap, always available).
 *  - loadWords(cats) / loadAllWords(): fetch lists (cached after the first load).
 *  - cachedWords(cat): synchronous lookup of a list that was already loaded (undefined otherwise).
 *    start() loads the selected categories first, so everything after it can use this.
 */
type Loader = () => Promise<string[]>;

const LOADERS: Record<string, Loader> = {
    "Animale": () => import("./animale.ts").then(m => m.animale),
    "Mâncare": () => import("./mancare.ts").then(m => m.mancare),
    "Locuri": () => import("./locuri.ts").then(m => m.locuri),
    "Meserii": () => import("./meserii.ts").then(m => m.meserii),
    "Obiecte": () => import("./obiecte.ts").then(m => m.obiecte),
    "Sport": () => import("./sport.ts").then(m => m.sport),
    "Transport": () => import("./transport.ts").then(m => m.transport),
    "Haine": () => import("./haine.ts").then(m => m.haine),
    "Natură": () => import("./natura.ts").then(m => m.natura),
    "Orașe și țări": () => import("./orase-tari.ts").then(m => m.oraseTari),
    "Casă": () => import("./casa.ts").then(m => m.casa),
    "Muzică": () => import("./muzica.ts").then(m => m.muzica),
    "Sărbători": () => import("./sarbatori.ts").then(m => m.sarbatori),
    "La școală": () => import("./la-scoala.ts").then(m => m.laScoala),
    "Crăciun": () => import("./craciun.ts").then(m => m.craciun),
    "București": () => import("./bucuresti.ts").then(m => m.bucuresti),
    "Anii '90": () => import("./anii-90.ts").then(m => m.anii90),
    "Eurovision": () => import("./eurovision.ts").then(m => m.eurovision),
    "Politicieni": () => import("./politicieni.ts").then(m => m.politicieni),
    "Personalități": () => import("./personalitati.ts").then(m => m.personalitati),
    "Filme și desene": () => import("./filme-desene.ts").then(m => m.filmeDesene),
    "Fructe și legume": () => import("./fructe-legume.ts").then(m => m.fructeLegume),
    "Tehnologie": () => import("./tehnologie.ts").then(m => m.tehnologie),
    "Corpul uman": () => import("./corpul-uman.ts").then(m => m.corpulUman),
    "Basme": () => import("./basme.ts").then(m => m.basme),
    "Instrumente": () => import("./instrumente.ts").then(m => m.instrumente),
    "Mâncare tradițională": () => import("./mancare-traditionala.ts").then(m => m.mancareTraditionala),
    "Locuri din România": () => import("./locuri-romania.ts").then(m => m.locuriRomania),
    "Proverbe și expresii": () => import("./proverbe.ts").then(m => m.proverbe),
    "Filme și seriale românești": () => import("./filme-romanesti.ts").then(m => m.filmeRomanesti),
    "Muzică românească": () => import("./muzica-romaneasca.ts").then(m => m.muzicaRomaneasca),
    "Paște și Halloween": () => import("./paste-halloween.ts").then(m => m.pasteHalloween),
    "Tradiții și datini": () => import("./traditii.ts").then(m => m.traditii),
    "Vacanță": () => import("./vacanta.ts").then(m => m.vacanta),
    /* optional pack, behind its own switch (state.pty): not part of CATEGORIES */
    "Petrecere": () => import("./petrecere.ts").then(m => m.petrecere),
};

/** File name (without .ts) of every category: the same list lives at words/<lang>/<file>.ts in another language (see scripts/words). */
export const CAT_FILE: Record<string, string> = {
    "Animale": "animale",
    "Mâncare": "mancare",
    "Locuri": "locuri",
    "Meserii": "meserii",
    "Obiecte": "obiecte",
    "Sport": "sport",
    "Transport": "transport",
    "Haine": "haine",
    "Natură": "natura",
    "Orașe și țări": "orase-tari",
    "Casă": "casa",
    "Muzică": "muzica",
    "Sărbători": "sarbatori",
    "La școală": "la-scoala",
    "Crăciun": "craciun",
    "București": "bucuresti",
    "Anii '90": "anii-90",
    "Eurovision": "eurovision",
    "Politicieni": "politicieni",
    "Personalități": "personalitati",
    "Filme și desene": "filme-desene",
    "Fructe și legume": "fructe-legume",
    "Tehnologie": "tehnologie",
    "Corpul uman": "corpul-uman",
    "Basme": "basme",
    "Instrumente": "instrumente",
    "Mâncare tradițională": "mancare-traditionala",
    "Locuri din România": "locuri-romania",
    "Proverbe și expresii": "proverbe",
    "Filme și seriale românești": "filme-romanesti",
    "Muzică românească": "muzica-romaneasca",
    "Paște și Halloween": "paste-halloween",
    "Tradiții și datini": "traditii",
    "Vacanță": "vacanta",
    "Petrecere": "petrecere",
};

/** Packs that only appear when their switch is on (state key in the value). They load like any category but are not in CATEGORIES. */
export const OPTIONAL_PACKS: Record<string, string> = { "Petrecere": "pty" };

/** The categories added in version 2 of the lists (see migrateCats). */
export const NEW_IN_V2: string[] = ["Mâncare tradițională", "Locuri din România", "Proverbe și expresii", "Filme și seriale românești", "Muzică românească", "Paște și Halloween", "Tradiții și datini", "Vacanță"];

/** True for every category name that has a list, optional packs included. */
export const isCategory = (cat: string): boolean => cat in LOADERS;

export const CATEGORIES: string[] = Object.keys(LOADERS).filter(c => !(c in OPTIONAL_PACKS));

/**
 * Saved `cats` from before version 2: a player who had every older category selected gets the new ones too
 * (someone who picked a few keeps exactly their choice). Pure, so it is unit-tested.
 */
export const migrateCats = (cats: unknown, version: number): string[] => {
    const list = Array.isArray(cats) ? cats.filter((c): c is string => typeof c === "string") : [...CATEGORIES];
    if (version >= 2) {
        return list;
    }
    const older = CATEGORIES.filter(c => !NEW_IN_V2.includes(c));
    return older.every(c => list.includes(c)) ? [...list, ...NEW_IN_V2.filter(c => !list.includes(c))] : list;
};

/* ---- languages ----
 * Romanian is the built-in language (the files above). Another language is a folder words/<lang>/ with the same file names, written by
 * `pnpm words:apply --lang <code>`; the glob finds them at build time, so adding a language needs no code change. A category that has no
 * file in the chosen language is simply not offered (availableCategories) and never reaches a round. */
// import.meta.glob exists only under Vite. The game server (bundled by wrangler/esbuild) imports this file too, and there the
// call throws at load, so it falls back to "no other languages" (the server only needs the Romanian lists).
const FOREIGN: Record<string, () => Promise<Record<string, unknown>>> = (() => {
    try {
        return import.meta.glob<Record<string, unknown>>(["./*/*.ts", "!./pairs/*.ts"]);
    } catch {
        return {};
    }
})();
const foreignPath = (cat: string, lang: string) => `./${lang}/${CAT_FILE[cat]}.ts`;

let wordLang = "ro";

/** The language of the word lists in use. Set by the language switch (i18n/index.svelte.ts). */
export const getWordLang = (): string => wordLang;

/** Languages that have word lists: Romanian plus every words/<lang>/ folder. */
export const wordLangs = (): string[] => ["ro", ...new Set(Object.keys(FOREIGN).map(k => k.split("/")[1]))];

/** True when the category has a list in that language. */
export const hasWords = (cat: string, lang: string = wordLang): boolean => (lang === "ro" ? cat in LOADERS : foreignPath(cat, lang) in FOREIGN);

/** The categories (not the optional packs) a player can pick in that language. Romanian: all of CATEGORIES. */
export const availableCategories = (lang: string = wordLang): string[] => CATEGORIES.filter(c => hasWords(c, lang));

/** A language only becomes selectable when it has enough categories to play with (at least 8). */
export const MIN_PLAYABLE_CATEGORIES = 8;
export const playableLangs = (): string[] => wordLangs().filter(l => availableCategories(l).length >= MIN_PLAYABLE_CATEGORIES);

/** Switches the word language. A language without playable lists is ignored (returns false), so the game never ends up with no words. */
export const setWordLang = (lang: string): boolean => {
    if (!playableLangs().includes(lang)) {
        return false;
    }
    wordLang = lang;
    return true;
};

const loaderFor = (cat: string, lang: string): Loader | undefined => {
    if (lang === "ro") {
        return LOADERS[cat];
    }
    const f = FOREIGN[foreignPath(cat, lang)];
    return f ? () => f().then(m => (Object.values(m).find(Array.isArray) as string[] | undefined) ?? []) : undefined;
};

const key = (cat: string, lang: string) => `${lang}|${cat}`;
const cache = new Map<string, string[]>();
const pending = new Map<string, Promise<string[]>>();

/** True when the list is already in memory (loadWords would resolve without a network request). */
export const isLoaded = (cat: string): boolean => cache.has(key(cat, wordLang));

export const cachedWords = (cat: string): string[] | undefined => cache.get(key(cat, wordLang));

export const loadCategory = (cat: string): Promise<string[]> => {
    const lang = wordLang;
    const k = key(cat, lang);
    const hit = cache.get(k);
    if (hit) {
        return Promise.resolve(hit);
    }
    let p = pending.get(k);
    if (!p) {
        const load = loaderFor(cat, lang);
        if (!load) {
            return Promise.resolve([]);
        }
        p = load().then(words => {
            cache.set(k, words);
            pending.delete(k);
            return words;
        }, err => {
            pending.delete(k); // allow a retry (e.g. offline the first time)
            throw err;
        });
        pending.set(k, p);
    }
    return p;
};

/** Loads the given categories in parallel. Unknown names are ignored. */
export const loadWords = async (cats: string[]): Promise<void> => {
    await Promise.all(cats.filter(c => hasWords(c)).map(loadCategory));
};

export const loadAllWords = (): Promise<void> => loadWords(availableCategories());

/** Warms the cache while the browser is idle, so pressing "start" does not wait for the network. */
export const preloadWords = (cats: string[]): void => {
    const run = () => void loadWords(cats).catch(() => {});
    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 4000 });
    }
    else {
        setTimeout(run, 1500);
    }
};
