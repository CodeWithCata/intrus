/**
 * SMIL (<animate>, <animateTransform>, ...) helpers. SMIL runs on the main thread and cannot be
 * switched off from CSS, so the pieces that cost something are handled here.
 */

type Clocked = SVGSVGElement & { pauseAnimations?: () => void; unpauseAnimations?: () => void };

/** Pauses (`on`) or resumes the animation clock of every <svg> under `root` (the page-hidden handler in boot.ts uses it). */
export const smil = (root: Element, on: boolean): void => {
    const svgs: Clocked[] = root.matches("svg") ? [root as Clocked] : [];
    svgs.push(...(Array.from(root.querySelectorAll("svg")) as Clocked[]));
    for (const v of svgs) {
        try {
            if (on) {
                v.pauseAnimations?.();
            }
            else {
                v.unpauseAnimations?.();
            }
        }
        catch {
            /* a detached or non-rendered <svg> may refuse; there is nothing to pause then */
        }
    }
};

/**
 * The icon sprite in app.html is never drawn: <Icon> copies a symbol's markup into its own <svg>
 * (components/ui/icons.ts), so the sprite's animations drive nothing visible. Left running, they
 * still wake the main thread on every frame, so its clock is stopped. Safe in every mode.
 */
export const freezeSprite = (): void => {
    try {
        (document.querySelector("svg.sprite") as Clocked | null)?.pauseAnimations?.();
    }
    catch {
        /* nothing to pause */
    }
};
