<script lang="ts">
  /** The .switch button. `checked` is bindable; `onchange` gets the new value. `hook` is the data-a styling hook. */
  let { checked = $bindable(false), disabled = false, label, hook, onchange }: { checked?: boolean; disabled?: boolean; label: string; hook?: string; onchange?: (checked: boolean) => void } = $props();
</script>

<button class="switch" role="switch" aria-checked={checked} {disabled} data-a={hook} aria-label={label} onclick={() => { checked = !checked; onchange?.(checked); }}></button>
