/**
 * "Install the app" (PWA). Chromium fires `beforeinstallprompt` once; we keep the event and replay it from a button.
 * iOS Safari never fires it, so there the button shows the manual steps instead. `installState.mode` drives the UI:
 * "prompt" (one tap installs), "ios" (Share > Add to Home Screen), "none" (already installed, or the browser cannot).
 */
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { t } from "#lib/i18n/index.svelte.ts";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;

const standalone = () => matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: window-controls-overlay)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** True for Chrome / Edge / Brave / Opera / Samsung Internet, which can install a PWA from their own menu even when the one-tap prompt is not offered. */
const chromium = () => {
    const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
    return brands ? brands.some((b) => /chrom|edge|opera|samsung/i.test(b.brand)) : /chrome|crios|edg\//i.test(navigator.userAgent);
};

/** Remembers that the app is installed on this device, so a visit in a normal browser tab hides the button too (the browser cannot tell us). Cleared if the one-tap prompt shows up again, which only happens when the app is not installed. */
const KEY = "intrus.installed";
const wasInstalled = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const markInstalled = (on: boolean) => { try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* storage blocked: the button just shows again */ } };

export const installState = $state<{ mode: "prompt" | "ios" | "manual" | "none" }>({ mode: "none" });

/** Called once at startup (boot.ts). */
export function initInstall(): void {
    if (standalone()) {
        markInstalled(true);
        return;
    }
    const flagged = wasInstalled();
    if (isIos() && !flagged) {
        installState.mode = "ios";
    }
    const got = (e: Event) => {
        e.preventDefault();
        markInstalled(false);
        deferred = e as InstallEvent;
        installState.mode = "prompt";
    };
    const early = (window as Window & { __bip?: Event }).__bip;
    if (early) {
        got(early);
    }
    window.addEventListener("beforeinstallprompt", got);
    /* No one-tap prompt after a few seconds (already offered, or the app is already installed here): still show the button and explain the menu way. */
    if (!isIos() && !flagged) {
        setTimeout(() => {
            if (installState.mode === "none" && chromium() && !standalone() && !flagged) {
                installState.mode = "manual";
            }
        }, 3000);
    }
    window.addEventListener("appinstalled", () => {
        markInstalled(true);
        deferred = null;
        installState.mode = "none";
    });
}

/** Opens the browser's install dialog. Returns false when there is no saved prompt (the caller then explains the manual way). */
export async function promptInstall(): Promise<boolean> {
    if (!deferred) {
        return false;
    }
    const e = deferred;
    deferred = null;
    await e.prompt();
    await e.userChoice;
    installState.mode = "none"; // accepted: installed; dismissed: Chromium fires the event only once per page load
    return true;
}

/** The button handler (settings and home screen): one tap installs where the browser allows it; otherwise (iOS, or the prompt was already used) say how to do it by hand. */
export async function installOrExplain(): Promise<void> {
    const ios = installState.mode === "ios";
    if (!(await promptInstall())) {
        toast(ios ? t("instIosSteps") : t("instManual"), { duration: 9000 });
    }
}
