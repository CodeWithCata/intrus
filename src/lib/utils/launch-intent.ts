/**
 * What the player asked for by how the app was opened. Today that is the two home-screen shortcuts declared in
 * static/manifest.json (long-press the app icon): `/?shortcut=new` and `/?shortcut=join`. Called once by boot(), after the
 * screen and the online store are up. A shortcut never throws away a round silently: "new" asks first (newGame() confirms)
 * and does nothing when the app is already at rest on the setup screen.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { nav, MID_ROUND } from "#lib/stores/nav.svelte.ts";
import { inRoom, onlineAvailable } from "#lib/online/client.svelte.ts";
import { newGame } from "#lib/game/session.ts";
import { shortcutFromSearch } from "#lib/utils/shortcut.ts";

export function runShortcut(): void {
    const which = shortcutFromSearch(location.search);
    if (!which) {
        return;
    }
    history.replaceState(null, "", location.pathname + location.hash);
    if (inRoom()) {
        return;
    }
    if (which === "join") {
        if (onlineAvailable && nav.screen === "setup") {
            state.ol = 1;
            state.sheet = "online";
        }
    }
    else if (nav.screen !== null && MID_ROUND.includes(nav.screen)) {
        newGame();
    }
}
