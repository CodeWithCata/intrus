<script lang="ts">
  /** Suggestions for the player-title input (`list="ttls"`). */
  const TITLES = ["Șeful suspecților", "Detectivul", "Ochi de vultur", "Mincinosul oficial", "Maestrul deghizării", "Regele bluffului", "Nasul din umbră", "Sherlock de buzunar", "Martorul-cheie"];
</script>

<datalist id="ttls">{#each TITLES as t, ki (ki)}<option value={t}></option>{/each}</datalist>
