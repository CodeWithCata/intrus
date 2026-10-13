<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { codeFromText } from "#lib/online/room.ts";
  import { setPendingJoin } from "#lib/online/client.svelte.ts";

  /* An invitation link (/online/ABCDEF): remember the code, then open the app. boot() (in +layout.svelte) runs right after
     this and opens the join sheet with the code filled in. */
  onMount(() => {
    setPendingJoin(codeFromText("/online/" + (page.params.room ?? "")));
    goto(resolve("/"), { replaceState: true });
  });
</script>
