import type { Player } from "#lib/game/types.ts";

/** The default name of a player who typed none ("Jucător 3"). The language switch replaces `fn` (i18n/index.svelte.ts), so this module stays free of the UI code. */
export const nameHook: { fn: (n: number) => string } = { fn: n => "Jucător " + n };

/**
 * uniqueId() and displayName(player,index).
 */

export const uniqueId = () => Math.random().toString(36).slice(2, 8), displayName = (p: Pick<Player, "n">, i: number) => p.n.trim() || nameHook.fn(i + 1);
