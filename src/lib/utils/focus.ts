/**
 * Focus helpers for the bottom sheets: a Tab trap (action), and remembering / restoring the element
 * that had focus before a sheet opened.
 */
const FOCUSABLE = "a[href],button,input,select,textarea,summary,[tabindex]";

/** Tabbable elements inside `root`, in DOM order (hidden, disabled, inert and tabindex=-1 ones are skipped). */
export function focusables(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        el => el.tabIndex >= 0 && !el.hasAttribute("disabled") && !el.closest("[hidden],[inert]") && !(el instanceof HTMLInputElement && el.type === "hidden")
    );
}

/** Action: Tab / Shift+Tab loop between the first and last focusable elements of `node`. */
export function trapFocus(node: HTMLElement) {
    const onkeydown = (e: KeyboardEvent) => {
        if (e.key !== "Tab") {
            return;
        }
        const list = focusables(node);
        if (!list.length) {
            e.preventDefault();
            node.focus();
            return;
        }
        const first = list[0], last = list[list.length - 1], active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
            // From the first control, or from the title / container (not in the list): wrap to the end.
            if (active === first || !active || !list.includes(active)) {
                e.preventDefault();
                last.focus();
            }
        }
        else if (active === last) {
            e.preventDefault();
            first.focus();
        }
    };
    node.addEventListener("keydown", onkeydown);
    return {
        destroy() {
            node.removeEventListener("keydown", onkeydown);
        }
    };
}

let opener: Element | null = null;

/** Called when a sheet opens: remembers the focused element (kept while one sheet replaces another). */
export function rememberFocus() {
    opener ??= document.activeElement;
}

/** Called when a sheet closes: focuses the remembered element, or runs `fallback` if it is gone. */
export function restoreFocus(fallback: () => void) {
    const el = opener;
    opener = null;
    if (el instanceof HTMLElement && el !== document.body && el.isConnected) {
        el.focus({ preventScroll: true });
    }
    else {
        fallback();
    }
}
