<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  import Icon from "#lib/components/ui/Icon.svelte";
  import { state } from "#lib/stores/settings.svelte.ts";
  import { groupById } from "#lib/stores/groups.svelte.ts";
  import AvatarStack from "#lib/components/players/AvatarStack.svelte";
  import { displayName } from "#lib/utils/id.ts";
  import { rematch } from "#lib/game/session.ts";

  // "Revanșă" shortcut shown on the home screen after a finished game; the parent only renders it
  // when state.rc holds at least 3 players.
  const rc = state.rc!;
  const group = groupById(rc.gid);
  const names: string[] = rc.pl.map(displayName);
  const who = names.slice(0, 3).join(", ") + (names.length > 3 ? " +" + (names.length - 3) : "");
</script>

<section class="panel pad rmc"
  ><div class="rh"
    ><AvatarStack players={rc.pl} count={4} size={40} /><div class="rt"><p class="rname">{group ? group.nm : t("rmLast")}</p><p class="rdesc">{who}</p></div></div
  ><button class="btn go" onclick={rematch}><Icon name="redo" />{t("suRematch")}</button></section
>
