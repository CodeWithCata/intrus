/**
 * Offers "Mod telefon slab" by itself when the first minute of play stutters, instead of waiting for the player to find the switch.
 *
 * It only watches when the answer could change something: lite mode is off, the player never touched that switch (a deliberate
 * "off" is respected) and we have not asked on this device before. It is a requestAnimationFrame counter for at most 45 s,
 * then it stops for good. A verdict of "poor" needs several stuttering windows in a row (see createFrameJudge), and the offer
 * is held back until the player is at rest (never mid-round, never over a sheet). It is shown once per device.
 */
import { t } from "#lib/i18n/index.svelte.ts";
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { LITE_HINT_KEY } from "#lib/storage/keys.ts";
import { MID_ROUND, nav } from "#lib/stores/nav.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { createFrameJudge } from "#lib/utils/frame-stats.ts";
import { toggleOption } from "./settings.ts";

type KV = Pick<Storage, "getItem" | "setItem">;

function storage(): KV | null {
    try {
        return localStorage;
    }
    catch {
        return null;
    }
}

export function alreadyAsked(kv: KV | null = storage()): boolean {
    try {
        return kv?.getItem(LITE_HINT_KEY) === "1";
    }
    catch {
        return false;
    }
}

function markAsked(kv: KV | null = storage()): void {
    try {
        kv?.setItem(LITE_HINT_KEY, "1");
    }
    catch {
        /* private mode: worst case it is asked again next visit */
    }
}

/** True when watching can lead somewhere: lite is off, the player never chose, nothing was asked before, motion is not already reduced. */
export function worthWatching(kv: KV | null = storage()): boolean {
    return !state.lite && !state.liteSet && !alreadyAsked(kv) && !matchMedia("(prefers-reduced-motion:reduce)").matches;
}

function offer(): void {
    markAsked();
    toast(t("liteHintMsg"), {
        action: t("liteHintAction"),
        duration: 10000,
        onaction: () => {
            if (!state.lite) {
                toggleOption("lite");
            }
            toast(t("liteHintOn"));
        }
    });
}

/** Waits (up to about 3 minutes) for a calm moment, then asks. */
function offerWhenAtRest(): void {
    let tries = 0;
    const timer = setInterval(() => {
        if (state.lite || state.liteSet || ++tries > 120) {
            clearInterval(timer);
        }
        else if (!document.hidden && !state.sheet && !MID_ROUND.includes(nav.screen!)) {
            clearInterval(timer);
            offer();
        }
    }, 1500);
}

export function watchForLite(): void {
    if (!worthWatching()) {
        return;
    }
    const judge = createFrameJudge();
    let last = 0;
    let raf = 0;
    const onVisibility = () => {
        last = 0;
        judge.reset();
    };
    const stop = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("visibilitychange", onVisibility);
    };
    const frame = (now: number) => {
        if (state.lite || state.liteSet) {
            stop();
            return;
        }
        if (last && !document.hidden) {
            const verdict = judge.push(now - last, now);
            if (verdict) {
                stop();
                if (verdict === "poor") {
                    offerWhenAtRest();
                }
                return;
            }
        }
        last = now;
        raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);
}
