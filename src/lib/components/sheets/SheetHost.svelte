<script lang="ts">
  /**
   * Mounted once by App.svelte. The bottom sheets live in `#sr` (a sibling of `#app`, so the
   * screen-shake and fade of `#app` do not touch them): SheetLayer is mounted there.
   */
  import { mount, unmount } from "svelte";
  import SheetLayer from "#lib/components/sheets/SheetLayer.svelte";

  $effect(() => {
    const target = document.getElementById("sr");
    if (!target) {
      return;
    }
    const layer = mount(SheetLayer, { target });
    return () => {
      unmount(layer);
    };
  });
</script>
