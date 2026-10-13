<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "#lib/components/ui/Icon.svelte";

  /** A .cr row: icon, name, description and an optional control (a switch, ...). `iconEl` is the icon's element; `fx` plays the sound / vibration icon effect (`fxOff`: the "turned off" variant), `onfxend` fires when it ends. */
  let { icon, name, description, off = false, iconEl = $bindable(), fx = null, fxOff = false, onfxend, control }: { icon: string; name: string; description: string; off?: boolean; iconEl?: HTMLElement; fx?: "snd" | "vb" | null; fxOff?: boolean; onfxend?: () => void; control?: Snippet } = $props();
</script>

<div class="cr" class:off
  ><span class="ri" class:fx-snd={fx === "snd"} class:fx-vb={fx === "vb"} class:fx-off={fx !== null && fxOff} bind:this={iconEl} onanimationend={(ev) => ev.target === ev.currentTarget && onfxend?.()}><Icon name={icon} /></span
  ><div class="rt"><p class="rname">{name}</p><p class="rdesc">{description}</p></div
  >{@render control?.()}</div
>
