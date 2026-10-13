<script lang="ts">
  import Row from "#lib/components/ui/Row.svelte";
  import Switch from "#lib/components/ui/Switch.svelte";
  import { Flash } from "#lib/components/ui/flash.svelte.ts";

  /** One on/off row of the settings and rules sheets. `fx` makes the row's icon play a short sound / vibration effect when the switch is flipped. */
  let { icon, title, desc, checked, off = false, hook, fx = null, onchange }: { icon: string; title: string; desc: string; checked: boolean; off?: boolean; hook?: string; fx?: "snd" | "vb" | null; onchange: () => void } = $props();
  const fxFlash = new Flash();
  let fxOff = $state(false);

  function change(now: boolean) {
    if (fx) {
      fxOff = !now;
      fxFlash.fire();
    }
    onchange();
  }
</script>

<Row {icon} name={title} description={desc} {off} fx={fxFlash.on ? fx : null} {fxOff} onfxend={() => fxFlash.clear()}>
  {#snippet control()}<Switch checked={checked && !off} disabled={off} label={title} {hook} onchange={change} />{/snippet}
</Row>
