/**
 * Opening and closing the bottom sheets. The sheets themselves are components
 * (components/sheets/*.svelte) mounted by SheetHost and driven by `state.sheet`.
 */
import type { SheetName } from "#lib/game/types.ts";
import { state } from "#lib/stores/settings.svelte.ts";

export type { SheetName };

export function openSheet(name: SheetName) {
    state.sheet = name;
}

export function closeSheet() {
    state.sheet = null;
}
