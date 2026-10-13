/**
 * Settings sheet logic: themes, accents, reveal style, sound/vibration switches, volume, card
 * design and timer-style pickers, applyTheme().
 */
import { state } from "#lib/stores/settings.svelte.ts";
import { prefersReducedMotion } from "#lib/utils/media.ts";
import { TKF } from "#lib/audio/tick-styles.ts";
import { RBP, rvSnd } from "#lib/audio/reveal-sounds.ts";
import { cineLoad } from "#lib/audio/cinematic.ts";
import { beep } from "#lib/audio/tone.ts";
import { vibrate } from "#lib/audio/haptics.ts";
import { speak, stopVoice } from "#lib/voice/host.ts";
import { CARD_DESIGNS, lk, rn } from "#lib/data/card-designs.ts";
import { toast } from "#lib/components/ui/toast.svelte.ts";
import { go } from "#lib/stores/nav.svelte.ts";
import { RELAXED_PRESET } from "#lib/game/relaxed.ts";
import { t } from "#lib/i18n/index.svelte.ts";

export const THEMES = ([["light", "Luminos"], ["dark", "Întunecat"], ["noir", "Noir"]] as any[][]), ACCS = ([["#D8002B", "Roșu"], ["#C2410C", "Portocaliu"], ["#15803D", "Verde"], ["#0F766E", "Turcoaz"], ["#1D4ED8", "Albastru"], ["#6D28D9", "Violet"], ["#BE185D", "Roz"]] as any[][]);


export const RP = "perspective(900px) ";

export interface RevealFx { l: string; sh?: number; od?: number; oe?: string; id?: number; ie?: string; o?: Keyframe[]; i?: Keyframe[] }

export const RV: Record<string, RevealFx> = {
    flip: { l: "Răsucire (implicit)", sh: 1, od: 220, oe: "cubic-bezier(.45,0,.85,.6)", id: 520, ie: "cubic-bezier(.22,.8,.3,1)",
        o: [{ transform: RP + "rotateY(0) rotateX(0) scale(1)" }, { transform: RP + "rotateY(90deg) rotateX(7deg) scale(1.07)" }],
        i: [{ transform: RP + "rotateY(-90deg) rotateX(7deg) scale(1.07)", offset: 0 }, { transform: RP + "rotateY(11deg) rotateX(-3deg) scale(1.08)", offset: .58 }, { transform: RP + "rotateY(-4deg) rotateX(1deg) scale(1.03)", offset: .8 }, { transform: RP + "rotateY(0) rotateX(0) scale(1)", offset: 1 }] },
    vflip: { l: "Salt vertical", sh: 1, od: 220, oe: "cubic-bezier(.45,0,.85,.6)", id: 520, ie: "cubic-bezier(.22,.8,.3,1)",
        o: [{ transform: RP + "rotateX(0) scale(1)" }, { transform: RP + "rotateX(90deg) scale(1.06)" }],
        i: [{ transform: RP + "rotateX(-90deg) scale(1.06)", offset: 0 }, { transform: RP + "rotateX(10deg) scale(1.06)", offset: .6 }, { transform: RP + "rotateX(-3deg) scale(1.02)", offset: .82 }, { transform: RP + "rotateX(0) scale(1)", offset: 1 }] },
    zoom: { l: "Zoom", od: 180, oe: "ease-in", id: 420, ie: "cubic-bezier(.22,1,.36,1)",
        o: [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.7)", opacity: 0 }],
        i: [{ transform: "scale(1.3)", opacity: 0, offset: 0 }, { transform: "scale(.97)", opacity: 1, offset: .6 }, { transform: "scale(1)", opacity: 1, offset: 1 }] },
    slide: { l: "Glisare", od: 220, oe: "ease-in", id: 460, ie: "cubic-bezier(.22,1,.36,1)",
        o: [{ transform: "translateX(0) rotate(0)", opacity: 1 }, { transform: "translateX(-70%) rotate(-10deg)", opacity: 0 }],
        i: [{ transform: "translateX(70%) rotate(10deg)", opacity: 0, offset: 0 }, { transform: "translateX(-3%) rotate(-1deg)", opacity: 1, offset: .7 }, { transform: "none", opacity: 1, offset: 1 }] },
    drop: { l: "Cădere", od: 200, oe: "ease-in", id: 560, ie: "ease-out",
        o: [{ transform: "translateY(0) scale(1)", opacity: 1 }, { transform: "translateY(40px) scale(.9)", opacity: 0 }],
        i: [{ transform: "translateY(-60px) scale(.9)", opacity: 0, offset: 0 }, { transform: "translateY(6px) scale(1.02)", opacity: 1, offset: .6 }, { transform: "translateY(-2px)", opacity: 1, offset: .8 }, { transform: "none", opacity: 1, offset: 1 }] },
    blur: { l: "Ceață", od: 240, oe: "ease-in", id: 480, ie: "ease-out",
        o: [{ filter: "blur(0)", opacity: 1, transform: "scale(1)" }, { filter: "blur(14px)", opacity: 0, transform: "scale(1.06)" }],
        i: [{ filter: "blur(14px)", opacity: 0, transform: "scale(.96)" }, { filter: "blur(0)", opacity: 1, transform: "scale(1)" }] },
    fade: { l: "Estompare", od: 200, oe: "linear", id: 450, ie: "ease-out", o: [{ opacity: 1 }, { opacity: 0 }], i: [{ opacity: 0 }, { opacity: 1 }] },
    none: { l: "Instant" }
};

export let RVT: ReturnType<typeof setTimeout> | undefined;

export const rvPrev = () => {
    const e = document.getElementById("rvc");
    if (!e || !e.animate) {
        return;
    }
    clearTimeout(RVT);
    e.getAnimations().forEach(x => x.cancel());
    e.classList.remove("on");
    const R = RV[state.rv] || RV.flip;
    if (!R.o || prefersReducedMotion()) {
        e.classList.add("on");
        RVT = setTimeout(() => e.classList.remove("on"), 1000);
        return;
    }
    const a = e.animate(R.o, { duration: R.od, easing: R.oe, fill: "forwards" });
    a.onfinish = () => {
        e.getAnimations().forEach(x => x.cancel());
        e.classList.add("on");
        e.animate(R.i!, { duration: R.id, easing: R.ie });
        RVT = setTimeout(() => e.classList.remove("on"), 1000);
    };
};

export const volTxt = () => state.snd ? t("stVolOn") : t("stVolOff");

export const rsTxt = () => state.snd ? t("stRsOn") : t("stNeedSound");

export const rbTxt = () => state.vb ? t("stRbOn") : t("stRbOff");

/**
 * Applies theme + accent. Every write restyles the whole page, so each one is skipped when nothing changes. The "?" wallpaper follows
 * `--red` and the theme through plain colours (see motion.css), so no image is rebuilt here; `data-acc` only picks the tiny accent tile of the sheet.
 */
export function applyTheme() {
    const h = document.documentElement;
    if (h.dataset.theme !== state.theme) {
        h.dataset.theme = state.theme;
    }
    if (h.style.getPropertyValue("--red") !== state.acc) {
        h.style.setProperty("--red", state.acc);
    }
    const acc = state.acc.slice(1).toUpperCase();
    if (h.dataset.acc !== acc) {
        h.dataset.acc = acc;
    }
    const m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (m) {
        m.content = { light: "#FFFFFF", dark: "#0F0F13", noir: "#000000" }[state.theme] || "#FFFFFF";
    }
}


/** "Mod telefon slab": fewer animations, for weak phones. */
export function applyLite() {
    document.documentElement.classList.toggle("lite", !!state.lite);
}

/** "Mod relaxat": bigger text (the `relaxed` class on <html> rescales the font tokens, see styles/base.css). Also called by boot(). */
export function applyRelaxed() {
    document.documentElement.classList.toggle("relaxed", !!state.rx);
}

/** The one-tap "Relaxat" preset of the setup screen: relaxed mode on, a longer timer, no surprises. */
export function applyRelaxedPreset() {
    Object.assign(state, RELAXED_PRESET);
    applyRelaxed();
    beep(560, .05);
    vibrate(10);
    toast(t("rxPreset"));
}

/**
 * Colour changes of a theme switch must land on every element in the same frame. Elements that have a `transition` on
 * background / colour / shadow would otherwise fade slowly while the rest snaps, which shows as a flash on phones.
 * So transitions are switched off (class `noswap`, see themes.css) for the frame that carries the change.
 */
function freezeTransitions() {
    const h = document.documentElement;
    h.classList.add("noswap");
    requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove("noswap")));
}

/** The theme cross-fade is only for mouse devices without lite mode or reduced motion: on phones it costs too many frames. */
const canFadeTheme = () => !state.lite && matchMedia("(hover:hover) and (pointer:fine)").matches && !matchMedia("(prefers-reduced-motion:reduce)").matches;

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/** Switches the theme. On a mouse device the browser cross-fades the old and the new page as one picture; elsewhere the switch is instant. */
export function pickTheme(v: string) {
    const apply = () => {
        freezeTransitions();
        state.theme = v;
        applyTheme();
    };
    const doc = document as ViewTransitionDocument;
    if (canFadeTheme() && doc.startViewTransition) {
        try {
            doc.startViewTransition(apply);
        }
        catch {
            apply();
        }
    }
    else {
        apply();
    }
    beep(560, .05);
    vibrate(10);
}

export function pickAccent(v: string) {
    freezeTransitions();
    state.acc = v;
    applyTheme();
    beep(660, .06);
    vibrate(12);
}

export function pickRevealAnim(k: string) {
    state.rv = k;
    setTimeout(rvPrev, 120);
    beep(560, .05);
    vibrate(10);
}

export function pickRevealSound(k: string) {
    state.rs = k;
    if (k !== "off") {
        rvSnd(k);
    }
    else {
        beep(400, .05);
    }
}

export function pickRevealBuzz(k: string) {
    state.rb = k;
    if (k !== "off") {
        vibrate(RBP[k as keyof typeof RBP]);
    }
}

/** Taps a card design. Returns true when it was applied, false when it is still locked (a toast says how many rounds are left). */
export function chooseCardDesign(id: string): boolean {
    const d = CARD_DESIGNS.find(x => x[0] == id)!;
    if (lk(d)) {
        const n = d[2] - state.rounds;
        toast(`Mai ai ${n} ${rn(n)} până la „${d[1]}”`);
        vibrate([20, 40]);
        return false;
    }
    state.cd = id;
    beep(660, .06);
    vibrate(10);
    return true;
}

export function pickTick(v: string) {
    state.tk = v;
    const k = TKF[v];
    if (v === "cine") {
        cineLoad();
        setTimeout(() => k.t(0), 160);
        setTimeout(() => k.t(0), 1160);
        setTimeout(() => k.t(1), 2160);
        setTimeout(k.e, 2900);
        return;
    }
    if (k) {
        k.t(0);
        setTimeout(() => k.t(0), 500);
        setTimeout(() => k.t(1), 1000);
        setTimeout(k.e, 1500);
    }
    else {
        beep(400, .05);
    }
}

/** The on/off switches of the settings and rules sheets (the icon effect lives in `SwitchRow`). */
export type OptionKey = "snd" | "vb" | "vh" | "lite" | "tw" | "qm" | "dr" | "wh" | "pv" | "rx" | "twn" | "kn" | "pty" | "gt";

export function toggleOption(key: OptionKey) {
    state[key] = !state[key];
    if (key == "lite") {
        state.liteSet = true;
        applyLite();
    }
    if (key == "rx") {
        applyRelaxed();
    }
    if (key == "pty" && !state.pty) {
        state.cats = state.cats.filter(c => c !== "Petrecere"); // the pack is hidden again: it must not stay selected
    }
    if (key == "vh") {
        if (state.vh) {
            speak(t("stVoiceOnSay"));
        }
        else {
            stopVoice();
        }
    }
    beep(560, .05);
    vibrate(key == "vb" && state.vb ? [14, 40, 14, 40, 14] : 10);
}

export function setVolume(percent: number) {
    state.vol = percent / 100;
}

export function showIntro() {
    state.sheet = null;
    go("intro");
}
