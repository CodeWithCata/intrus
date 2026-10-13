/**
 * vibrate() wrapper (respects the vibration setting; calmer pulses in relaxed mode).
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { calmVibration } from "#lib/game/relaxed.ts";

export const vibrate = (p?: any) => {
    if (!state.vb) {
        return;
    }
    try {
        navigator.vibrate?.(state.rx && p !== undefined && p !== 0 ? calmVibration(p) : p);
    }
    catch {
        // best effort: this must never break the game
    }
};
