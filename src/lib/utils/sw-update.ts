/**
 * Keeps an installed app current. A phone PWA is almost never closed, only sent to the background, and
 * the browser looks for a new service worker only on a navigation, so without this an update could
 * wait for weeks. Two things happen when the app comes back to the foreground:
 *   1. registration.update() looks for a new build (at most every 10 minutes; a conditional request).
 *   2. When a new worker is installed and waiting, `onReady` is called so the app can show an "Update" button
 *      (components/ui/UpdateBanner.svelte). Nothing is applied behind the player's back: only a tap on that
 *      button (`applyUpdate()`) tells the waiting worker to take over, and the page then reloads once.
 *      A round in progress is never interrupted: the banner only shows while `canReload()` is true, and
 *      if the player ignores it the update simply waits until the app is closed and opened again.
 * The worker itself never calls skipWaiting() on its own (see service-worker.ts).
 */
const MIN_GAP_MS = 10 * 60 * 1000;

let waiting: ServiceWorker | null = null;
let requested = false;
let doReload: () => void = () => location.reload();

/** The player tapped "Update": the waiting worker takes over (controllerchange then reloads the page). Returns false when nothing is waiting. */
export function applyUpdate(): boolean {
  if (!waiting) {
    return false;
  }
  requested = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
  // Safety net: if the worker never reports back, still reload so the button never hangs.
  setTimeout(() => doReload(), 4000);
  return true;
}

export function initUpdates(canReload: () => boolean, reload: () => void = () => location.reload(), onReady: () => void = () => {}): void {
  waiting = null;
  requested = false;
  doReload = reload;
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const sw = navigator.serviceWorker;
  // The very first install also fires "controllerchange" (the worker claims the page): that is not an update.
  const hadController = !!sw.controller;
  let reloading = false;
  let lastCheck = 0;

  sw.addEventListener("controllerchange", () => {
    if (hadController && !reloading && (requested || canReload())) {
      reloading = true;
      reload();
    }
  });

  /** A worker is installed and waiting behind the running one: tell the app so it can offer the update. */
  const found = (worker: ServiceWorker | null | undefined) => {
    if (worker && hadController) {
      waiting = worker;
      onReady();
    }
  };
  const watch = (reg: ServiceWorkerRegistration) => {
    found(reg.waiting);
    reg.addEventListener?.("updatefound", () => {
      const next = reg.installing;
      next?.addEventListener("statechange", () => {
        if (next.state === "installed") {
          found(reg.waiting ?? next);
        }
      });
    });
  };
  // An update downloaded in an earlier session may already be waiting.
  void sw.getRegistration().then(reg => reg && watch(reg)).catch(() => {});

  const check = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheck < MIN_GAP_MS) {
      return;
    }
    lastCheck = now;
    try {
      const reg = await sw.getRegistration();
      if (!reg) {
        return;
      }
      await reg.update();
      found(reg.waiting);
    } catch {
      // Offline or the worker script could not be fetched: try again at the next foreground.
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void check();
    }
  });
  // A long-lived tab that never went to the background still gets one check shortly after start.
  setTimeout(() => void check(true), 8000);
}
