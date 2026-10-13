<script lang="ts">
  /** A real, scannable QR code for `text` (online/qr.ts). The picture is drawn from our own path data, never from user markup. */
  import { qrPath } from "#lib/online/qr.ts";

  let { text }: { text: string } = $props();
  const qr = $derived(qrPath(text));
</script>

<svg class="qr" viewBox="-4 -4 {qr.size + 8} {qr.size + 8}" shape-rendering="crispEdges" role="img" aria-label="Cod QR pentru cameră"><rect x="-4" y="-4" width={qr.size + 8} height={qr.size + 8} rx="2.5" fill="#fff" /><path d={qr.d} fill="#111114" /></svg>
