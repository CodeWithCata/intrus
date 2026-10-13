<script lang="ts">
  // Test-only screen that reports when it was mounted and destroyed.
  import { onMount } from "svelte";
  let { log }: { log: { mounted: number; destroyed: number } } = $props();
  onMount(() => {
    log.mounted++;
    return () => log.destroyed++;
  });
</script>

<p class="probe">probe</p>
