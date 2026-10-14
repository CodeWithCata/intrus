# Intrus: AI guide (read this first, ~2k tokens)

Party game "one of you lies": everyone gets the same word except the intruder. SvelteKit 3 + Svelte 5 + TypeScript. UI is Romanian; English exists for online play. Paths are from the repo root; `#lib/…` = `src/lib/…`.

## Token-saving rules for AI agents
- Never read: `tests/golden/*`, `pnpm-lock.yaml`, `static/`, `src/lib/assets/` (`.claude/settings.json` denies these).
- Read only if the task is about them, and then by `grep` or line range, not whole: `src/app.html` (66 KB: shell + icon sprite), `src/lib/styles/*.css` (grep the class; order and contents in `docs/ai/architecture.md`), `src/lib/data/words/**` (word lists), `src/lib/components/debug/*` (dev-only profiler, `docs/ai/mobile-pwa-a11y.md` item 6), `src/lib/i18n/{ro,en}.ts` (grep the key), `server/tests/room-logic.test.ts` (57 KB).
- Find a file with `docs/ai/FILE-MAP.md` (one line per source file: purpose + exports) before opening or searching anything. Regenerate with `pnpm map`.
- Open the topic doc for your area (table below), not all of them.
- Edit with small targeted edits; never print or rewrite whole files.

## Which doc to open
| If you touch… | Open |
|---|---|
| navigation, `state` / `round` stores, bottom sheets, toasts, UI parts, folder layout | `docs/ai/architecture.md` |
| avatar drawing, avatar builder, `Player.a` / `Player.l` | `docs/ai/avatars.md` |
| a feature (drama, wheel, twins, relaxed, presets, packs, list sharing) or a recipe (new sheet / category / twist / look / timer preset) | `docs/ai/features-recipes.md` |
| PWA, service worker, wake lock, audio, battery, themes, a11y, debug profiler | `docs/ai/mobile-pwa-a11y.md` |
| online client or `server/` | `docs/ai/online.md` |
| strings, `t()`, Netlify deploy, old short names (`cu*`, `rv*`, `wl*`, `g*`) | `docs/ai/i18n-deploy.md` |
| something that "was already failing" | "Known issues" below |

## Commands and verification
- `pnpm install` (add `--config.minimumReleaseAge=0` if the lockfile is refused), `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm format`.
- `pnpm check` = svelte-check + `tsc -p server/tsconfig.json`. `pnpm test` = vitest (jsdom, includes `server/tests`). `pnpm test:workers`, `pnpm test:e2e`.
- Run a subset: `pnpm vitest run <part-of-file-name>`.
- After a change: `pnpm check`, `pnpm test`, then play a round in `pnpm dev`: intro → setup → start → pass (gate, then card) → vote → reveal → scoreboard. `tests/unit/boot.smoke.test.ts` plays a whole round in jsdom.
- Golden DOM tests (`tests/golden/*.html`: setup and intro) must not change for markup that already existed. `ACTUAL_DIR=/tmp/x pnpm test` dumps what renders so it can be diffed. Regenerate on purpose only, and last: `UPDATE_GOLDEN=1 pnpm vitest run tests/unit/setup.golden.test.ts`.
- CI (`.github/workflows/ci.yml`): lint, check, test, build.

## Golden rules
0. Import app code as `#lib/<path>` **with the file extension** (`#lib/stores/ui.svelte.ts`, `#lib/views/PassScreen.svelte`). `$lib` no longer exists in SvelteKit 3.
1. **Never rename keys of `state`** (`k`, `tm`, `cats`, `hint`, `cu`, `qm`, …) or of groups/players: they are saved in users' browsers. Add a migration in `stores/settings.svelte.ts` if a shape must change. The saved key names are pinned by `tests/unit/stores.test.ts`.
2. **User text is text.** Put it in templates as `{p.n}`; Svelte escapes it. Never build HTML strings, never assign `innerHTML`, never pass player names, group names, custom words, list names or hints to `{@html}`. `{@html}` is only for constant, trusted SVG/markup from the code itself (`CDB`/`BACK`/`CBG` card backs, `CONE`, `TROPHY`, the background, the icon sprite), each with a one-line comment above it saying so. There is no `escapeHtml()`.
3. **Keep class names and markup**: CSS in `styles/` targets them. **Do not change the design.** No `<style>` blocks in components; CSS lives in `src/lib/styles/` (cascade order: tokens → base → motion → themes → card-designs → performance).
4. **Buttons**: write `onclick={myFunction}` and import the function from the module that owns the logic (also inside a sheet). No string keys, no `data-a` / `data-f` delegation.
5. **Navigation is `go(screen, props?)`** and nothing else. Screens and `views/*.ts` logic never import each other (no circular imports). Never read another module's value at import time, only inside functions.
6. **Strings**: every new user-facing string is a key in both `i18n/ro.ts` and `i18n/en.ts`, used through `t()`. Messages with variables use `{name}` placeholders, never string joining (see Translations).
7. **Types**: no `any` in new code. `Round`, `Player`, `Group` and `PlayerStats` (`game/types.ts`) are strict interfaces without index signatures: add a field there before using a new one. `alwaysStrict`, `noImplicitThis` and `strictBindCallApply` are on; the roadmap for the other flags is in `tsconfig.json`.
8. **Intruder choice** is decided only by `game/intruders.ts` (`pickIntruders`), shared by the local game and the server. Last round's intruders are less likely, **never excluded**: do not turn that into a hard exclusion (it lets the table rule a player out).
9. **Text typed by players that other devices will show** goes through `cleanText()` on the server (`server/room-core.ts`).
10. **Avatars**: the meaning of `Player.a` indexes 0–11 must never change, nor the bit layout of `Player.l` or `BROW_ORDER` (see Avatars below).
11. A new round screen must be in `MID_ROUND` (or `needsAwake`), or the phone will dim during it.
12. A new screen needs an `h1` (or `role="heading" aria-level="1"`, else `h2`): `go()` moves focus there.

## Screen flow
`intro` → `setup` → `start()` (`game/engine.ts`) → `pass` (per player: **gate**, then card) → `talk` (timer) → `vote` → `tally` → `reveal` (or `troll`) → `end(outcome)` = `scoreboard` → `start()` again.

| Screen | Component | Logic file |
|---|---|---|
| intro | `views/IntroScreen.svelte` + `components/intro/slides/` | `views/intro.ts` |
| setup | `SetupScreen` | `views/setup.ts` |
| pass | `PassScreen` + `components/game/Card.svelte` | `views/pass.ts` |
| talk | `TalkScreen` | `views/talk.ts` |
| vote / simultaneous vote | `VoteScreen` / `SimVoteScreen` | `views/vote.ts` / `views/svote.ts` |
| tally | `TallyScreen` | `views/tally.ts` |
| reveal | `RevealScreen` (and `TrollRevealScreen`, reached from `go("reveal")` when `round.troll`) | `views/reveal.ts` |
| scoreboard | `ScoreboardScreen` | shown by `end()` in `game/engine.ts` |
| online | `OnlineScreen` | `online/client.svelte.ts` |

### The pass screen (two steps)
- **Gate first.** `PassScreen` opens on a gate: big avatar, `h1` "Dă telefonul lui {name}", a warning line and the button `#gt` "Sunt {name}". Nothing secret is on screen, so whoever still holds the phone sees nothing.
- **Then the card.** Tapping `#gt` sets the local `ready` state, plays a small beep/vibration, and moves focus to the card step's `h1`. The card step (`.who`, `Card`, `#nx`, `#nt`) is the original markup.
- The gate is local component state: every `go("pass", { i })`, and a resumed mid-round session, starts on the gate again. Nothing about it is persisted and there is no setting for it.
- Keys: `passGateHandOver`, `passGateWarn`, `passGateGo` (the older `passTo`, `passNote`, `ready` are still unused spare keys). CSS: `.gate` in `styles/base.css`.
- Tests that walk the pass screens must tap `#gt` before the card exists (`boot.smoke.test.ts`, `screens.behaviour.test.ts`) and call `flushSync()` after every click.

## Known issues (Oct 2026)
- `pnpm check` (strict TypeScript, `tsc` for `server/`), `pnpm test` (655 tests) and `pnpm lint` (0 errors) are all clean. Keep them clean; a failure is yours.
- `pnpm lint` still prints 114 warnings (mostly `no-explicit-any` and unused variables). They are warnings, not errors.
- Temporary: `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` lists seven packages published on 2026-10-14 (Playwright 1.64.1, wrangler 4.151.0, and others). Delete that block once they are more than a day old, then run `pnpm install` to confirm.
- `pnpm test:workers` cannot run yet: `@cloudflare/vitest-pool-workers` needs vitest ^4.1 and the repo is on vitest 5 (see `server/vitest.workers.config.ts`).
- Planned, not built: round recap card + share button; "best liar / most caught" line (needs a saved group, see Group stats in `docs/ai/features-recipes.md`).
- Open server findings (CSP, unverified Cloudflare assumptions): `docs/ai/online.md` ("Still open").
- Inline Romanian is still in about 38 Svelte files (only online UI, the pass gate and a few messages use `t()`).
