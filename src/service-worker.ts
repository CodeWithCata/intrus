// Service worker: precaches the build, network-first navigation with cached-shell fallback, no skipWaiting without a page message.
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * Offline support. SvelteKit registers this file automatically.
 *
 * - install: precaches the CORE of the app (JS/CSS chunks - including the lazy word lists - fonts,
 *   manifest) plus the SPA fallback page, under a cache named after the build `version`. Only the core
 *   blocks the install, so the worker is ready quickly even on a slow connection.
 * - warm (message WARM_CACHE, sent by app.html while the splash is showing; progress and the end are posted back as
 *   WARM_PROGRESS / WARM_DONE, which the splash uses for its thin progress line and to wait, on a first visit only, until the app is cached): downloads the rest
 *   (images, audio, icons) in the background, a few files at a time, skipping what is already cached and
 *   tolerating failures (retried on the next start). It is skipped on Save-Data / 2G connections; those
 *   files are then cached on first use by the fetch handler.
 * - activate: deletes the caches of older builds.
 * - fetch: precached files are served cache-first; page navigations get the cached SPA shell
 *   (network first, so a new deploy shows up). The network only gets NAV_TIMEOUT_MS to answer: on a
 *   slow or flaky connection (a party in a bar, a train) the game opens from the cache instead of
 *   hanging on a blank screen, and the fresh shell is still stored for next time. A server error
 *   never replaces a shell we already have. Navigation preload overlaps the network request with the
 *   worker's own start-up.
 *
 * A new version never takes over by itself: it waits until every tab of the old one is closed, so a
 * running game never mixes chunks of two builds. The page (utils/sw-update.ts) may ask a waiting
 * worker to take over with a SKIP_WAITING message, but only while the player is at rest.
 */
import { immutable, assets } from "$app/manifest";
import { version } from "$app/env";

const sw = self as unknown as ServiceWorkerGlobalScope;

/**
 * Behind an ngrok tunnel the offline cache does more harm than good: ngrok's free plan answers requests that lack its
 * cookie with an HTML "Visit Site" warning page (status 200). Caching that page as the app shell, or as a script or
 * stylesheet, leaves the app stuck on an endless spinner. So on a tunnel host this worker does nothing except remove
 * its own caches and unregister (which also cleans up a worker installed by an earlier visit).
 */
const TUNNEL = /(^|\.)ngrok(-free)?\.(app|dev|io|pizza)$/i.test(sw.location.hostname);

const CACHE = `intrus-${version}`;
const SHELL = "/index.html";
/** How long a page navigation waits for the network before opening the cached shell. */
const NAV_TIMEOUT_MS = 3000;
// Absolute pathnames, so they match `url.pathname` in the fetch handler below.
const abs = (p: string) => (p.startsWith("/") ? p : `/${p}`);
// SvelteKit 3 lists files as `{ path }` objects (older versions: plain strings). Accept both, or `.startsWith` throws at load.
const toPath = (f: string | { path: string }): string => (typeof f === "string" ? f : f.path);
const ASSETS = [...new Set([...(immutable ?? []), ...(assets ?? [])].map(toPath).map(abs).concat(SHELL))];
const PRECACHED = new Set(ASSETS);
/** What the app cannot start without: code, styles, fonts, manifest and the shell. Everything else is fetched in the background. */
const isCore = (p: string) => p === SHELL || /\.(?:m?js|css|woff2?|json|html)$/i.test(p);
const CORE = ASSETS.filter(isCore);
const WARM = ASSETS.filter(p => !isCore(p));
/** Parallel downloads of the background pass: enough to be quick, few enough not to starve the page's own requests. */
const WARM_CONCURRENCY = 3;
let warming: Promise<void> | undefined;

/** True on a metered or very slow connection, where a background download of media would cost the player more than it helps. */
function frugal(): boolean {
    const c = (sw.navigator as { connection?: { saveData?: boolean; effectiveType?: string } } | undefined)?.connection;
    return !!c && (c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g");
}

/** Tells every open page how the background download is going (the splash shows it and waits for it on a first visit). */
async function tell(msg: { type: string; done?: number; total?: number }): Promise<void> {
    try {
        for (const client of (await sw.clients.matchAll?.({ type: "window", includeUncontrolled: true })) ?? []) {
            client.postMessage(msg);
        }
    } catch {
        // A page that went away meanwhile does not matter.
    }
}

async function warm(): Promise<void> {
    if (frugal()) {
        await tell({ type: "WARM_DONE" });
        return;
    }
    const cache = await caches.open(CACHE);
    const queue: string[] = [];
    for (const path of WARM) {
        if (!(await cache.match(path))) {
            queue.push(path);
        }
    }
    const total = queue.length;
    let done = 0;
    const worker = async () => {
        for (let path = queue.shift(); path; path = queue.shift()) {
            try {
                const res = await fetch(path);
                if (res.ok) {
                    await cache.put(path, res);
                }
            } catch {
                // Offline or flaky: the file is picked up by the next pass (or cached on first use).
            }
            await tell({ type: "WARM_PROGRESS", done: ++done, total });
        }
    };
    await Promise.all(Array.from({ length: Math.min(WARM_CONCURRENCY, queue.length) }, worker));
    await tell({ type: "WARM_DONE" });
}

sw.addEventListener("install", event => {
    if (TUNNEL) {
        event.waitUntil(sw.skipWaiting());
        return;
    }
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});

sw.addEventListener("activate", event => {
    if (TUNNEL) {
        event.waitUntil(
            (async () => {
                for (const key of await caches.keys()) {
                    if (key.startsWith("intrus-")) {
                        await caches.delete(key);
                    }
                }
                await sw.registration.unregister();
            })()
        );
        return;
    }
    event.waitUntil(
        (async () => {
            for (const key of await caches.keys()) {
                if (key.startsWith("intrus-") && key !== CACHE) {
                    await caches.delete(key);
                }
            }
            await sw.registration.navigationPreload?.enable();
            await sw.clients.claim();
        })()
    );
});

sw.addEventListener("message", event => {
    const type = event.data?.type;
    if (TUNNEL) {
        // Nothing is cached here, so tell the page at once that there is nothing to wait for.
        if (type === "WARM_CACHE") {
            event.waitUntil(tell({ type: "WARM_DONE" }));
        }
        return;
    }
    if (type === "SKIP_WAITING") {
        void sw.skipWaiting();
    } else if (type === "WARM_CACHE") {
        // One pass at a time; the worker is kept alive until it is done.
        warming ??= warm().finally(() => {
            warming = undefined;
        });
        event.waitUntil(warming);
    }
});

sw.addEventListener("fetch", event => {
    if (TUNNEL) {
        return;
    }
    const req = event.request;
    if (req.method !== "GET") {
        return;
    }
    const url = new URL(req.url);
    if (url.origin !== sw.location.origin) {
        return;
    }

    if (req.mode === "navigate") {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE);
                const cached = await cache.match(SHELL);
                const network = (async () => {
                    const fresh = (await event.preloadResponse) ?? (await fetch(req));
                    // Only keep a real page as the shell (a captive portal or 404 must not replace it).
                    if (fresh.ok && fresh.headers.get("content-type")?.includes("text/html")) {
                        // Not awaited (the page must not wait for the disk), but the worker is kept alive for it.
                        event.waitUntil(cache.put(SHELL, fresh.clone()).catch(() => undefined));
                    }
                    // A server error is no reason to leave the player without the app we already hold.
                    return fresh.ok || !cached ? fresh : cached;
                })();
                // Let the worker live until the network answer has arrived, even when the cache already answered.
                event.waitUntil(network.catch(() => undefined));
                if (!cached) {
                    // First visit: nothing to fall back on, so wait for the network.
                    return network.catch(() => Response.error());
                }
                const timeout = new Promise<Response>(resolve => setTimeout(() => resolve(cached), NAV_TIMEOUT_MS));
                return Promise.race([network.catch(() => cached), timeout]);
            })()
        );
        return;
    }

    if (PRECACHED.has(url.pathname)) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE);
                const hit = await cache.match(url.pathname);
                if (hit) {
                    return hit;
                }
                const res = await fetch(req);
                if (res.ok) {
                    cache.put(url.pathname, res.clone());
                }
                return res;
            })()
        );
    }
});
