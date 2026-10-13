/**
 * Twin-word pairs ("Cuvinte gemene"), one lazy chunk per category, loaded like the word lists (never imported statically).
 * Only the categories listed in PAIR_LOADERS have pairs; a round of twin words draws from the selected categories that do.
 */
export type Pair = [string, string];

const PAIR_LOADERS: Record<string, () => Promise<Pair[]>> = {
    "Animale": () => import("./animale.ts").then(m => m.animale),
    "Mâncare": () => import("./mancare.ts").then(m => m.mancare),
    "Locuri": () => import("./locuri.ts").then(m => m.locuri),
    "Obiecte": () => import("./obiecte.ts").then(m => m.obiecte),
    "Sport": () => import("./sport.ts").then(m => m.sport),
    "Transport": () => import("./transport.ts").then(m => m.transport),
    "Natură": () => import("./natura.ts").then(m => m.natura),
};

/** The categories that have twin pairs. */
export const PAIR_CATEGORIES: string[] = Object.keys(PAIR_LOADERS);

export const hasPairs = (cat: string): boolean => cat in PAIR_LOADERS;

const cache = new Map<string, Pair[]>();

export const pairsLoaded = (cat: string): boolean => cache.has(cat);

export const cachedPairs = (cat: string): Pair[] => cache.get(cat) ?? [];

/** Loads the pairs of the given categories (the ones without pairs are ignored). A failed load can be retried. */
export const loadPairs = async (cats: string[]): Promise<void> => {
    await Promise.all(cats.filter(hasPairs).filter(c => !cache.has(c)).map(c => PAIR_LOADERS[c]().then(p => void cache.set(c, p))));
};
