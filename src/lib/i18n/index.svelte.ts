/**
 * Reactive translations. In a component: `{t("olStartRound")}` or `{t("olInRoom", { n: 3 })}`. `t` reads `locale.lang`, so every
 * place that uses it updates by itself when the language changes. Romanian is the default and the fallback.
 */
import { DEFAULT_LANG, LANGS, LANG_LABEL, readStoredLang, translate, writeStoredLang, type Lang, type Params } from "./core.ts";
import { getWordLang, playableLangs, setWordLang } from "#lib/data/words/index.ts";
import { en } from "./en.ts";
import { nameHook } from "#lib/utils/id.ts";
import { LABELS_EN } from "./labels.ts";
import { ro, type MessageKey } from "./ro.ts";

export type { Lang, MessageKey, Params };
export { LANGS } from "./core.ts";

/** `lang` is the language of the texts; `words` is the language of the word lists in use (they differ while a language has texts but no playable word lists yet). */
export const locale = $state<{ lang: Lang; words: string }>({ lang: DEFAULT_LANG, words: "ro" });

/** The languages a player can pick: the ones that have playable word lists. Empty options mean there is nothing to choose, so no picker is shown. */
export const languageOptions = (): (readonly [Lang, string])[] => (playableLangs().length > 1 ? LANGS.filter((l) => playableLangs().includes(l)).map((l) => [l, LANG_LABEL[l]] as const) : []);

/** Applies the saved language. Called once at startup (boot.ts). */
export function initLocale(): void {
  setLang(readStoredLang(), false);
}

export function setLang(lang: Lang, save = true): void {
  locale.lang = lang;
  locale.words = setWordLang(lang) ? lang : getWordLang();
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  if (save) writeStoredLang(lang);
}

export function t(key: MessageKey, params?: Params): string {
  return translate(locale.lang === "en" ? en : ro, ro, key, params);
}

/** Shows the English text of a Romanian table label (themes, sounds, card designs...) when the language is English; otherwise the label as is. */
export function tr(label: string): string {
  return locale.lang === "en" ? (LABELS_EN[label] ?? label) : label;
}

nameHook.fn = (n) => t("defPlayer", { n });
