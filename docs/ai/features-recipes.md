# Feature notes and recipes

## Feature notes
- **Vote drama + fake-out**: `game/drama.ts` (pure plan: roll, fake, flip, reveal; ≤ 3 s; the fake is never an intruder and never touches scoring), `views/tally.ts` / `TallyScreen` (rows one by one), `views/reveal.ts` / `components/game/RevealDrama.svelte` (opacity-only cover over the already-rendered result). Setting `state.dr`. Off when `isCalm()` (`utils/calm.ts`: lite, relaxed or reduced motion).
- **Opening wheel**: `game/wheel.ts` + `components/game/FirstWheel.svelte` (one rotating disc, Web Animations; `round.first` is chosen by the engine, the wheel only lands on it). It runs in lite mode ("Mod telefon slab") too; only relaxed mode and `prefers-reduced-motion` turn it off (`wheelAllowed()` in `utils/calm.ts`, used by `views/talk.ts` and `OnlineTalk.svelte`, mirrored in `styles/performance.css`). The other v2 effects still follow `isCalm()`.
- **Last-seconds dim + heartbeat**: `game/tension.ts`, `TalkDim.svelte`, `stores/talk.svelte.ts`.
- **Privacy guard**: `components/game/peek-guard.ts` used by `Card.svelte` (setting `state.pv`; sensors only after `requestMotion()` from the pointerdown gesture). Separate from the pass gate above.
- **Simultaneous vote**: `state.vm`, `game/simvote.ts`, `views/vote.ts` (redirect or toast fallback), `views/svote.ts` + `SimVoteScreen.svelte`. Votes are anonymous (`round.anon`), so `recordRoundStats` skips per-voter stats.
- **Twin words / known partners**: `game/twins.ts`, `data/words/pairs/*` (lazy), `game/engine.ts` (`round.tn`, `round.twin`, `round.kn`); the two switches exclude each other.
- **Relaxed mode**: `state.rx`, `game/relaxed.ts`, `html.relaxed` (font tokens in `styles/features.css`), the switch lives in Settings (`SetSheet`, `toggleOption("rx")`); the setup screen no longer has a card for it (`applyRelaxedPreset` in `settings.ts` is kept, unused). `talkSeconds(minutes, relaxed, blitz)` = minutes × 60 × 1.5 if relaxed, halved by the Blitz twist.
- **Timer presets**: `TIMES = [1, 2, 3, 5, 0]` minutes in `components/rules/rules-ui.ts` (0 = no timer). 1 minute is for short games. See the timer recipe below.
- **Word packs**: 8 new categories (`NEW_IN_V2`, `migrateCats` for saved games, `state.cv`) and the optional `Petrecere` pack (`OPTIONAL_PACKS`, switch `state.pty`, not in `CATEGORIES`).
- **List sharing**: `game/list-share.ts` (pure, validates untrusted input), `stores/list-share.svelte.ts`, `LshareSheet` / `LimportSheet`; `#l=` links are read once by `boot()`.
- **Group stats**: per-player stats (`PlayerStats`, `game/scoring.ts`) are recorded only for saved groups, so anything built on them (e.g. "best liar", "most caught") shows nothing for a plain unsaved game.
- **Not available online**: groups and their stats only (`ONLINE_UNSUPPORTED` in `online/room.ts`). Twists, question mode, troll rounds, twin words, known partners and the host's custom word list all work online: the client only sends switches and the host's list (`settingsFromApp`), the server (`server/room-*.ts`) deals everything, and the shared pure rules live in `game/twist-rules.ts` and `game/twins.ts`.


## Recipes
### New bottom sheet
1. Add the name to `SheetName` (`components/ui/sheets.ts`), write `components/sheets/<n>Sheet.svelte` (takes `open`, wraps everything in `<Sheet {open} title="…" onclose={closeSheet} name="…">`) and register it in the `sheets` map of `SheetLayer.svelte` (typed `Record<SheetName, Component>`, so a missing entry fails to compile).
2. Same markup and class names as the other sheets: title from the `title` prop, subtitle in `head`, header button in `aside`, footer button a direct child of `.sheet` (`<button class="btn go" onclick={closeSheet}>Gata</button>`). No `<style>` blocks.
3. Open it with `openSheet("name")` (or set `state.sheet` from a handler). Put handlers in the owning module; use `onclick` / `bind:value`; keep element ids that CSS or code targets (`#cn`, `#kv`, `#cw`, `#rvc`, …).
4. `flushSync()` in a handler only when it must touch DOM that depends on the state it just changed (focus, a `.pop` / `.in` class).
5. Goldens must not change for markup that already existed.

### New word category
Add `data/words/<n>.ts` (`export const x: string[]`); register it as a dynamic `import()` in `LOADERS` in `data/words/index.ts`; add its word count to `data/words/counts.ts` (a test checks it); add an icon in `data/category-icons.ts`. Lists are lazy chunks: use `CATEGORIES` for names, `cachedWords(cat)` for a list `start()` already loaded, `loadWords(cats)` anywhere else. **Never import a list file statically.**

### New twist
Add a row to `TWISTS` in `game/twists.ts` and handle its `id` where `round.tw` is used (talk / reveal / engine).

### New avatar looks
- A new legacy variant: append an entry to `VARIANTS` in `avatar-parts.ts` (never reorder or edit 0–3 in a way that changes indexes 0–11).
- A new builder feature (a hair style, a mouth, a new field): add it at the END of its table, or give it new bits above bit 27 in `LOOK_BITS` (keep `LOOK_MAX` below 2^31, the codec uses 32-bit shifts), default 0 = the original look, add it to `AvatarLook`, `PLAIN_EXTRAS`, `isLookCode`, `lookToCode`, `codeToLook` and `randomLook`. Draw it in `Avatar.svelte` guarded by `{#if look.<feature>}` (off for photos unless it is clothing), add a row to `parts` in `AvatarSheet.svelte` (page + optional `show` rule), add the `av…` keys to `ro.ts` and `en.ts`, update the pinned layout test, then dump and look at the faces (see Commands).

### New or changed timer preset
Touch all of: `TIMES` (`rules-ui.ts`), the online mapping `MINUTES` in `src/lib/online/room.ts` (`settingsFromApp` rounds to the nearest), the server `MINUTES` in `server/room-core.ts` **and** the `v.picklist([...])` in `server/protocol.ts`. If there are 5+ options the `Segmented` sets `--n` for the grid and the sliding pill (`base.css`, `themes.css`). Tests: `tests/unit/rules.timer.test.ts`, `tests/unit/online.room.test.ts`, `server/tests/protocol.test.ts`, `server/tests/room-logic.test.ts`.

