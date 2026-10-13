/** Framework-free i18n helpers (pure, unit-tested). The reactive wrapper is index.svelte.ts. */

export const LANGS = ["ro", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "ro";
/** Language names, shown in their own language on purpose (so they are never translated). */
export const LANG_LABEL: Record<Lang, string> = { ro: "Română", en: "English" };
export const LANG_KEY = "intrus.lang";

export type Params = Record<string, string | number>;

export const isLang = (x: unknown): x is Lang => typeof x === "string" && (LANGS as readonly string[]).includes(x);

/** The stored language if it is a supported one, else the default. */
export const detectLang = (stored: string | null | undefined): Lang => (isLang(stored) ? stored : DEFAULT_LANG);

/** Replaces {name} with params.name. A placeholder without a value is left visible, so a mistake shows up instead of hiding. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** The sorted, unique placeholder names used in a string. */
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

/** Looks the key up in `dict`, falls back to `fallback` (Romanian), then to the key itself. */
export function translate(dict: Readonly<Record<string, string>>, fallback: Readonly<Record<string, string>>, key: string, params?: Params): string {
  return interpolate(dict[key] ?? fallback[key] ?? key, params);
}

export function readStoredLang(kv: Pick<Storage, "getItem"> | null = safeStorage()): Lang {
  try {
    return detectLang(kv?.getItem(LANG_KEY));
  } catch {
    return DEFAULT_LANG;
  }
}

export function writeStoredLang(lang: Lang, kv: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    kv?.setItem(LANG_KEY, lang);
  } catch {
    /* blocked or full: the language still changes for this visit */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
