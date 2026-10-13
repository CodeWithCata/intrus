<script lang="ts">
  import { toasts, type ToastItem } from "#lib/components/ui/toast.svelte.ts";

  const current = $derived(toasts.length ? toasts[toasts.length - 1] : null);
  // The last toast stays rendered while #toast fades out.
  let last = $state<ToastItem | null>(null);
  $effect(() => {
    if (current) {
      last = current;
    }
  });
</script>

<div id="toast" class:on={current !== null} role="status" aria-live="polite">{#if last}{#key last.id}<span class="tmsg">{last.message}</span>{#if last.action}<button class="tbtn" onclick={() => last?.onaction?.()}>{last.action}</button>{/if}<i class="tbar"></i>{/key}{/if}</div>
