/**
 * Launch splash. The markup, CSS and start script live in app.html (so it paints before any script loads); boot calls hideSplash()
 * once the app is up. The letters need SHOW ms from the moment their animation started (app.html stores it in window.__splashGo),
 * so the build always finishes before the fade; if the app is slower than that, the splash simply waits for it.
 * First visit: it then also waits (at most 1.5 s) for the service worker to finish caching the app, with a thin progress line.
 * Reduced motion: no animation wait and no fade.
 */
const SHOW = 1300;
const FADE = 300;

export function hideSplash(): void {
    const el = document.getElementById("splash");
    if (!el) {
        return;
    }
    const calm = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const started = (window as Window & { __splashGo?: number }).__splashGo ?? 0;
    const wait = calm ? 0 : Math.max(0, started + SHOW - performance.now());
    // On a first visit the splash also waits (app.html caps it at 1.5 s) until the service worker has cached the app.
    const cached = (window as Window & { __swWait?: Promise<void> }).__swWait ?? Promise.resolve();
    setTimeout(() => {
        void cached.then(() => {
            if (calm) {
                el.remove();
                return;
            }
            el.classList.add("out");
            setTimeout(() => el.remove(), FADE + 50);
        });
    }, wait);
}
