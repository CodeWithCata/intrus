<!-- Base bottom sheet: dialog markup, focus trap, inert #app, exit transition, drag to close. Every sheet wraps in it. -->
<script lang="ts">
  /**
   * The one wrapper of every bottom sheet: .scrim > .sheet with role="dialog", the title (#st) and the
   * exit transitions. Opening focuses the title, remembers the previous focus and makes #app inert;
   * Tab is trapped inside; Escape, a click on the scrim and dragging the sheet down (sheet-drag.ts) call `onclose`. With `head` / `aside` the
   * title sits in a .shead (subtitle snippet / button snippet), otherwise it is a bare heading.
   */
  import { getContext, setContext, type Snippet } from "svelte";
  import { trapFocus, rememberFocus, restoreFocus } from "#lib/utils/focus.ts";
  import { focusScreenHeading } from "#lib/stores/ui.svelte.ts";
  import { scrimOut, sheetOut } from "#lib/components/ui/sheet-motion.ts";
  import { dragToClose } from "#lib/components/ui/sheet-drag.ts";

  let { open, title, onclose, name, head, aside, children }: { open: boolean; title: string; onclose: () => void; name?: string; head?: Snippet; aside?: Snippet; children: Snippet } = $props();

  const gone = getContext<(() => void) | undefined>("sheet-gone");
  setContext("sheet-icons", true);
  let sheetEl = $state<HTMLElement>();
  let wasOpen = false;

  // While open: the page behind is inert and the title has focus.
  $effect(() => {
    if (!open || !sheetEl) {
      return;
    }
    const app = document.getElementById("app");
    app?.setAttribute("inert", "");
    rememberFocus();
    const h = sheetEl.querySelector<HTMLElement>("#st");
    (h ?? sheetEl).focus({ preventScroll: true });
    return () => app?.removeAttribute("inert");
  });

  // On close: back to where the focus was (or the screen heading if that element is gone).
  $effect(() => {
    if (open) {
      wasOpen = true;
    }
    else if (wasOpen) {
      wasOpen = false;
      restoreFocus(focusScreenHeading);
    }
  });
</script>

<svelte:document onkeydown={(e) => open && e.key === "Escape" && onclose()} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="scrim" out:scrimOut onoutroend={() => gone?.()} onclick={(e) => e.target === e.currentTarget && onclose()}>
    <div class="sheet" data-k={name} role="dialog" aria-modal="true" aria-labelledby="st" tabindex="-1" bind:this={sheetEl} use:trapFocus use:dragToClose={onclose} out:sheetOut><div class="grab"></div>{#if head || aside}<div class="shead"><div><h2 class="h1" id="st" tabindex="-1">{title}</h2>{@render head?.()}</div>{@render aside?.()}</div>{:else}<h2 class="h1" id="st" tabindex="-1">{title}</h2>{/if}{@render children()}</div>
  </div>
{/if}
