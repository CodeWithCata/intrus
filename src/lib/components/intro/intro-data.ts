/**
 * Intro slide texts [title, description]. The slide pictures are components in intro/slides/
 * (same order); views/IntroScreen.svelte renders both.
 */
import { ro } from "#lib/i18n/ro.ts";

/** The Romanian pairs, built from ro.ts (one source). The screen shows them through `t` with the keys below, so English follows the language. */
export const IS = ([[ro.isT1, ro.isD1], [ro.isT2, ro.isD2], [ro.isT3, ro.isD3]] as any[][]);
export const IS_KEYS = [["isT1", "isD1"], ["isT2", "isD2"], ["isT3", "isD3"]] as const;
