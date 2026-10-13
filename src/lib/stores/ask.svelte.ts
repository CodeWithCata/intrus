/**
 * The confirm sheet ("Ieși din rundă?", ...): ask() fills `askState` and opens the `ask` sheet,
 * which AskSheet.svelte renders from it.
 */
import { state } from "#lib/stores/settings.svelte.ts";

export const askState = $state<{ t: string; d: string; y: string; f: () => void }>({ t: "", d: "", y: "", f: () => {} });

export const ask = (t: string, d: string, y: string, f: () => void) => {
    askState.t = t;
    askState.d = d;
    askState.y = y;
    askState.f = f;
    state.sheet = "ask";
};

/** "Confirm" button of the ask sheet: closes it, then runs what was asked. */
export function confirmAsk() {
    const f = askState.f;
    state.sheet = null;
    f();
}
