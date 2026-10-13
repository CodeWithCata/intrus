<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /** "Ascultă din nou": makes the voice host repeat the talk intro. */
  import Icon from "#lib/components/ui/Icon.svelte";
  import { sayTalkIntro } from "#lib/game/questions.svelte.ts";
</script>

<button class="pillbtn vhb" onclick={sayTalkIntro}><Icon name="vol" />{t("rdListenAgain")}</button>
