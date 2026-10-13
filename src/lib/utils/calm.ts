/**
 * "Calm" = the effects of the new features stay off or simple. True in lite mode ("Mod telefon slab"), in relaxed mode
 * ("Mod relaxat") and under `prefers-reduced-motion`. Used by the vote drama, the fake-out and the dim (the opening wheel has
 * its own rule, `wheelAllowed` below).
 * Sound and vibration are NOT part of this: they follow their own settings (state.snd / state.vb), see audio/.
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { prefersReducedMotion } from "#lib/utils/media.ts";

export const isCalm = (): boolean => !!state.lite || !!state.rx || prefersReducedMotion();

/**
 * The opening wheel is the one effect that also runs in lite mode ("Mod telefon slab"): it is a single transform-only disc
 * and players want to see it on phones, which is where lite is on by default. It still stays off in relaxed mode
 * ("Mod relaxat") and under `prefers-reduced-motion`. Used by views/talk.ts and components/online/OnlineTalk.svelte, and
 * mirrored in styles/performance.css (no `html.lite .wheelbox` rule there).
 */
export const wheelAllowed = (): boolean => !state.rx && !prefersReducedMotion();
