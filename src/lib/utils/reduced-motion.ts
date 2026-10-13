/**
 * prefers-reduced-motion for the one kind of animation CSS cannot switch off: SMIL (<animate>,
 * <animateTransform>, ...) inside SVG, used by the sprite icons in app.html. They are removed, so
 * the elements keep their static attributes (a complete, resting icon). New SVG added later (screens,
 * sheets) is cleaned by a MutationObserver. Everything else is covered by the media query in
 * styles/base.css (CSS) and prefersReducedMotion() (Web Animations, requestAnimationFrame, smooth scroll).
 *
 * The preference is read when the app starts and when it changes to "reduce"; switching back to
 * "no preference" takes effect after a reload (the removed SMIL cannot be restored).
 */
import { reducedMotionQuery } from "#lib/utils/media.ts";

const SMIL = "animate,animateTransform,animateMotion";

const strip = (root: ParentNode) => {
    root.querySelectorAll(SMIL).forEach(el => el.remove());
};

let observer: MutationObserver | undefined;

const apply = () => {
    if (!reducedMotionQuery.matches || observer) {
        return;
    }
    strip(document);
    observer = new MutationObserver(records => {
        for (const r of records) {
            r.addedNodes.forEach(n => n instanceof Element && (n.matches(SMIL) ? n.remove() : strip(n)));
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
};

export function initReducedMotion() {
    apply();
    reducedMotionQuery.addEventListener("change", apply);
}
