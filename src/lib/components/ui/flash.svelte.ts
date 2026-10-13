/**
 * A class flag for a short effect (pop, bump, icon fx): bind it with `class:pop={flash.on}`.
 * `fire(key?)` turns it on and, when `ms` > 0, off again after `ms` ms; with `ms` 0 it stays on until
 * `clear()` (needed where the CSS must keep the class, e.g. `.cats .cat:not(.pop)`). Firing again
 * restarts the CSS animation. `key` tells which of several elements it applies to (`flash.key === i`).
 */
import { flushSync } from "svelte";

export class Flash {
    key = $state<unknown>(null);
    #ms: number;
    #t: ReturnType<typeof setTimeout> | undefined;

    constructor(ms = 0) {
        this.#ms = ms;
    }

    get on() {
        return this.key !== null;
    }

    fire(key: unknown = true) {
        clearTimeout(this.#t);
        if (this.key !== null) {
            // drop the class and let the browser see that, so the animation starts over
            this.key = null;
            flushSync();
            void document.body.offsetWidth;
        }
        this.key = key;
        if (this.#ms > 0) {
            this.#t = setTimeout(() => this.clear(), this.#ms);
        }
    }

    clear() {
        clearTimeout(this.#t);
        this.key = null;
    }
}
