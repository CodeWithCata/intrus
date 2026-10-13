/**
 * Which player the avatar builder sheet is editing. Kept here (like `askState` for the confirm sheet), not in `state`,
 * because it is only a pointer for the open sheet and must never be saved.
 */
import { state } from "#lib/stores/settings.svelte.ts";

export const avatarEdit = $state<{ i: number; from: "players" | "online" }>({ i: 0, from: "players" });

/** Tap on a player's avatar in the players sheet: opens the builder for player `i`. */
export function openAvatarBuilder(i: number, from: "players" | "online" = "players") {
    avatarEdit.i = i;
    avatarEdit.from = from;
    state.sheet = "avatar";
}

/** "Gata" (and Escape / scrim) in the builder: back to the sheet it was opened from (the players list, or the online room). */
export function closeAvatarBuilder() {
    state.sheet = avatarEdit.from;
}
