/**
 * App entry. boot() is called once from routes/+layout.svelte after the DOM exists: it wires
 * the global pointer feedback and page-visibility listeners, starts the autosave effect, applies
 * theme + lite mode, then shows the intro or the setup screen.
 */
import { initOnline, inRoom } from "#lib/online/client.svelte.ts";
import { initLocale } from "#lib/i18n/index.svelte.ts";
import { state, initAppEl } from "#lib/stores/settings.svelte.ts";
import { CARD_DESIGNS, lk } from "#lib/data/card-designs.ts";
import { TKS } from "#lib/audio/tick-styles.ts";
import { shine, tapSound } from "#lib/animations/motion.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { initReducedMotion } from "#lib/utils/reduced-motion.ts";
import { smil, freezeSprite } from "#lib/utils/smil.ts";
import { preloadWords } from "#lib/data/words/index.ts";
import { startAutosave, loadSession, requestDurableStorage } from "#lib/storage/persist.svelte.ts";
import { applyLite, applyRelaxed, applyTheme } from "#lib/components/settings/settings.ts";
import { watchForLite } from "#lib/components/settings/lite-hint.ts";
import { go, nav, MID_ROUND, type Screen } from "#lib/stores/nav.svelte.ts";
import { resetRound } from "#lib/stores/ui.svelte.ts";
import { resumeTalkTimer } from "#lib/stores/talk.svelte.ts";
import type { Round } from "#lib/game/types.ts";
import { initAudioLifecycle } from "#lib/audio/engine.ts";
import { initWakeLock } from "#lib/utils/wake-lock.svelte.ts";
import { initUpdates } from "#lib/utils/sw-update.ts";
import { update } from "#lib/stores/update.svelte.ts";
import { initInstall } from "#lib/stores/install.svelte.ts";
import { talkSeconds } from "#lib/game/relaxed.ts";
import { importFromHash } from "#lib/stores/list-share.svelte.ts";
import { clearBadge } from "#lib/utils/app-badge.ts";
import { initNetworkStatus } from "#lib/utils/network-status.ts";
import { runShortcut } from "#lib/utils/launch-intent.ts";

/** Resumes a saved mid-round screen. Returns false (nothing changed) when the saved data is missing or invalid. */
function restoreSession(): boolean {
    const s = loadSession(), n = state.players.length;
    const screen = s?.nav?.screen as Screen, props = s?.nav?.props, r = s?.round;
    if (!s || !MID_ROUND.includes(screen) || !n || !r || typeof r.word !== "string" || !Array.isArray(r.votes) || !Array.isArray(r.intr)
        || !r.intr.every((x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < n)) {
        return false;
    }
    if (screen === "pass" || screen === "vote") {
        const i = props?.i;
        if (!Number.isInteger(i) || i < 0 || i >= n) {
            return false;
        }
    }
    resetRound(r as Round);
    if (screen === "talk" && state.tm && (s.talkEnd > 0 || s.talkRem > 0)) {
        resumeTalkTimer(+s.talkEnd || 0, +s.talkRem || 0, talkSeconds(state.tm, state.rx, r.tw == "blitz"));
        go(screen, { resume: true });
    }
    else {
        go(screen, props && typeof props === "object" ? props : undefined);
    }
    return true;
}

/**
 * The flash debugger (the bug button) is a developer tool, so it is not built for players: it is loaded
 * on demand, only when the URL has ?debug=1 (remembered on this device) until ?debug=0 turns it off.
 */
const DEBUG_KEY = "intrus.dbgui";
export function debugWanted(): boolean {
    try {
        const q = new URLSearchParams(location.search).get("debug");
        if (q === "1") {
            localStorage.setItem(DEBUG_KEY, "1");
        }
        else if (q === "0") {
            localStorage.removeItem(DEBUG_KEY);
        }
        return localStorage.getItem(DEBUG_KEY) === "1";
    }
    catch {
        return false;
    }
}

/** True when CSS hides the tap ripple (styles/performance.css), so building it would be wasted work on every tap. */
const noRipple = matchMedia("(hover:none),(pointer:coarse),(max-width:820px)");

export { smil };

export function boot(): void {
    initAppEl();
    freezeSprite();
    initReducedMotion();
    startAutosave();
    preloadWords(state.cats);
    state.rounds = +state.rounds || 0;
    if (!CARD_DESIGNS.some(d => d[0] == state.cd && !lk(d))) {
        state.cd = "classic";
    }
    if (!TKS[state.tk]) {
        state.tk = "calm";
    }
    document.addEventListener("pointerdown", (e: any) => {
        const b = e.target.closest(".btn,.outcome,.sum,.hbtn,.round,.addrow,.chip,.seg button,.link,.pillbtn,.cat,.suspect,.pick,.switch");
        if (!b || b.disabled) {
            return;
        }
        tapSound();
        vibrate(6);
        if (b.classList.contains("go")) {
            shine(b);
        }
    }, { passive: true });
    document.addEventListener("pointerdown", (e: any) => {
        if (noRipple.matches) {
            return;
        }
        const b = e.target.closest(".btn,.outcome,.sum,.hbtn,.round,.addrow,.chip,.seg button,.link,.pillbtn");
        if (!b || b.disabled) {
            return;
        }
        const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, i = document.createElement("i");
        i.className = "rip";
        i.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
        b.appendChild(i);
        setTimeout(() => i.remove(), 600);
    }, { passive: true });
    /* pause all decorative motion while the page is hidden / phone locked */
    document.addEventListener("visibilitychange", () => {
        const h = document.hidden;
        document.documentElement.classList.toggle("tabhidden", h);
        smil(document.documentElement, h);
        if (!h) {
            freezeSprite();
            clearBadge();
        }
    });
    if (debugWanted()) {
        void import("#lib/components/debug/debug.ts").then(m => m.initDebug());
    }
    initAudioLifecycle();
    initWakeLock();
    applyLite();
    applyRelaxed();
    applyTheme();
    let localGameRestored = false;
    if (!state.seen) {
        go("intro");
    }
    else {
        localGameRestored = restoreSession();
        if (!localGameRestored) {
            go("setup");
        }
    }
    initLocale();
    initInstall();
    initOnline(localGameRestored);
    /* a long-press shortcut of the app icon (/?shortcut=new | join), after the screen and the online store are up */
    runShortcut();
    clearBadge();
    initNetworkStatus();
    /* a shared word list arrives as a link with #l=...: it only opens the confirm sheet, on the setup screen, and nothing is added without a tap */
    if (nav.screen === "setup") {
        void importFromHash();
    }
    /* Offer "Mod telefon slab" by itself if the first screens stutter on this device (once, only if the player never chose). */
    watchForLite();
    /* A phone app is rarely closed: look for updates when it returns to the foreground and offer an "Update" button (UpdateBanner) when one is ready. */
    initUpdates(() => nav.screen === "setup" && !state.sheet && !inRoom(), undefined, () => {
        update.ready = true;
    });
    /* Ask for non-evictable storage once the game is clearly in use (installed, or a round already played). */
    if (state.rounds > 0 || matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: window-controls-overlay)").matches) {
        (window.requestIdleCallback || ((f: () => void) => setTimeout(f, 2000)))(() => void requestDurableStorage());
    }
}
