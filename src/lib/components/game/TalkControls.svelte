<script lang="ts">
  import { t } from "#lib/i18n/index.svelte.ts";
  /** Pause / "+1 min" buttons under the timer; the label and icon follow the reactive talkClock. */
  import Icon from "#lib/components/ui/Icon.svelte";
  import { talkClock, togglePause, addMinute } from "#lib/stores/talk.svelte.ts";

  /** Online, the host's buttons ask the server instead of the local timer. */
  let { onpause = togglePause, onadd = addMinute }: { onpause?: () => void; onadd?: () => void } = $props();
</script>

<div class="acts tctl"><button class="btn" id="tp" onclick={onpause}><Icon name={talkClock.paused ? "play" : "pause"} />{talkClock.paused ? t("liContinue") : t("rdPause")}</button><button class="btn" onclick={onadd}><Icon name="plus" />1 {t("suMin")}</button></div>
