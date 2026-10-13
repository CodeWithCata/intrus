/**
 * Pass-the-phone logic: each player holds the card to see the word (or INTRUS). After the last
 * player the discussion starts.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { go, onEnter } from "#lib/stores/nav.svelte.ts";

onEnter("pass", props => {
    if (Number(props?.i) >= state.players.length) {
        go("talk");
        return false;
    }
});
