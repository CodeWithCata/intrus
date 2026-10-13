/**
 * Keeps the screen on while a round is being played. A round is passed from hand to hand and then
 * discussed for minutes with the phone lying on the table, so without this the screen dims or locks
 * in the middle of the talk timer. The lock is held only on round screens (never on setup or in a
 * menu, so it costs no battery there), is given back as soon as the round ends, and is taken again
 * when the app returns to the foreground (the browser releases it whenever the page is hidden).
 * Browsers without the Screen Wake Lock API, or that refuse it (battery saver), just do nothing.
 */
import { nav, MID_ROUND } from "#lib/stores/nav.svelte.ts";

/** Screens during which the phone must not go to sleep. "online" is only shown while a round or its scores are on. */
export const needsAwake = (screen: string | null): boolean => !!screen && (screen === "online" || (MID_ROUND as string[]).includes(screen));

export function initWakeLock(): void {
  if (!("wakeLock" in navigator)) {
    return;
  }
  let lock: WakeLockSentinel | null = null;
  let want = false;
  let pending = false;

  const acquire = async () => {
    if (!want || lock || pending || document.hidden) {
      return;
    }
    pending = true;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (!want) {
        // The round ended while the request was in flight.
        void sentinel.release().catch(() => {});
      } else {
        lock = sentinel;
        sentinel.addEventListener("release", () => {
          if (lock === sentinel) {
            lock = null;
          }
        });
      }
    } catch {
      // Refused (battery saver, permissions policy): the game works the same, the screen just may dim.
    } finally {
      pending = false;
    }
  };

  const release = () => {
    const held = lock;
    lock = null;
    void held?.release().catch(() => {});
  };

  $effect.root(() => {
    $effect(() => {
      want = needsAwake(nav.screen);
      if (want) {
        void acquire();
      } else {
        release();
      }
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void acquire();
    }
  });
}
