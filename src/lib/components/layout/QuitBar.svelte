<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /** Header with only the "leave the round" button (talk and reveal screens). */
  import Icon from "#lib/components/ui/Icon.svelte";
  import { quitRound } from "#lib/game/session.ts";
</script>

<header class="bar"><button class="round" onclick={quitRound} aria-label={t("rdQuitAria")}><Icon name="x" /></button><span class="sp"></span></header>
