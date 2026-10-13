/**
 * localStorage key.
 */
/** localStorage key that holds the whole saved game state (see storage/persist.svelte.ts). Bump the suffix only together with a migration. */

export const STORAGE_KEY = "intrus.v6";

/** localStorage flag: the "Mod telefon slab" suggestion was already shown on this device (see components/settings/lite-hint.ts). Never asked twice. */
export const LITE_HINT_KEY = "intrus.litehint";
