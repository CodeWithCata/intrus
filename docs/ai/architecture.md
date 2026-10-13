# Architecture: screens, state, sheets, handlers, UI parts

Read when you touch navigation, stores, bottom sheets, toasts or shared UI components. Paths from repo root; `#lib/` = `src/lib/`.

## Screens and navigation
- `src/lib/App.svelte` is rendered once by `src/routes/+layout.svelte` (inside `#app`). It shows the screen named by `nav.screen` (`nav = $state({ screen, props, n })` in `stores/nav.svelte.ts`) through a screen → component map inside `{#key nav.n}`, so each `go()` destroys the previous screen and renders a fresh one.
- Only `App.svelte` imports the screen components.
- A `views/<screen>.ts` file keeps the logic (sounds, timers, scoring) as an enter hook registered with `onEnter("<screen>", fn)`. `go()` runs it before the screen is shown; it may return the props to render, or `false` after redirecting with `go()`.
- `afterRender(fn)` queues work that needs the new DOM (count-up, …).
- After every screen change `App.svelte`'s effect scrolls to the top, focuses the heading (`focusScreenHeading`), sets the `--k` stagger and runs the queued work.
- Rendering happens in an effect, so **call `flushSync()` in tests after `go()` and after clicks**.
- `src/routes/+layout.svelte` imports the CSS and calls `boot()` (`src/lib/boot.ts`) in `onMount`. All sub-routes redirect to `/`.

## State
- **Reactive, no refresh calls.** `state` (`stores/settings.svelte.ts`, type `State` in `game/types.ts`), `round` (`stores/ui.svelte.ts`, type `Round`: `{ word, cat, intr: number[], troll, first, votes, hint, tw, … }`), `talkClock` (`stores/talk.svelte.ts`) and `questionState` (`game/questions.svelte.ts`) are `$state`. Components bind to them directly (`{state.k}`, `bind:value={state.custom}`, `class:low={talkClock.t <= 10}`). Change the state and the screen follows.
- `round` is never reassigned: `resetRound(v)` empties it and copies `v` in.
- Plain `let` exports that other modules assign are avoided: use a reactive object or a small module with functions (`startTalkTimer`, `clearCustomEntries`).
- **Persistence is one effect.** `startAutosave()` (`storage/persist.svelte.ts`, called from `boot()`) re-runs when any persisted field changes and writes 300 ms later. Do not add save calls. `state` is stored in `localStorage` (key in `storage/keys.ts`).
- The snapshot also carries the session under the extra keys `round`, `nav` (`{ screen, props }`), `talkEnd` and `talkRem`, written only while a mid-round screen (`MID_ROUND`) is showing, so they vanish when the round ends or is quit.
- `boot()` resumes a valid saved mid-round screen with `go(saved.screen, saved.props)` (the talk timer restarts from `talkClock.talkEnd` via `resumeTalkTimer`) and falls back to setup otherwise.
- `saveStateNow()` is only for page hide and leaving the intro.

## Bottom sheets and confirmations
- One component per `state.sheet` value: `components/sheets/{Help,Set,Players,Avatar,Cats,Rules,Online,Groups,Gstats,Gname,Lname,Ask}Sheet.svelte` (plus `Lshare`, `Limport`).
- `SheetHost` (rendered once by `App.svelte`) mounts `SheetLayer` into `#sr`, a sibling of `#app` (so the screen shake / fade of `#app` does not touch the sheets). `SheetLayer` mounts the component named by `state.sheet` and passes it `open`.
- Every sheet wraps itself in **`components/ui/Sheet.svelte`** (`open`, `title`, `onclose`, `children`; optional `name`, and `head` / `aside` snippets for the subtitle and a header button). `Sheet` is the only place that renders `.scrim > .sheet > .grab` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby="st"` and the title `<h2 class="h1" id="st" tabindex="-1">`. A sheet passes `title` and never writes its own `#st`.
- `Sheet` owns the behaviour: exit is a Svelte `out:` transition (`components/ui/sheet-motion.ts`: scrim fade 240 ms, sheet slide 260 ms, duration 0 under `prefersReducedMotion()`); on open it remembers `document.activeElement`, focuses `#st`, sets `inert` on `#app` and traps Tab (`trapFocus`, `utils/focus.ts`); Escape and a scrim click call `onclose`; on close it removes `inert` and restores focus (fallback `focusScreenHeading`).
- **Drag to dismiss** (`components/ui/sheet-drag.ts`, the `use:dragToClose` action on `.sheet`): drag the grabber, title or header (Pointer Events) or, on touch, the body while it is scrolled to the top (non-passive Touch Events). Past 30% of the height or a downward flick it calls `onclose`; otherwise it springs back. `sheetOut` reads `data-dy` / `data-vy` so the exit continues from where the finger let go; the dim follows through `--dim` on `.scrim::before`. Buttons, inputs and `[data-nodrag]` never start a drag. CSS: last block of `styles/themes.css`.
- Closing keeps the component mounted with `open={false}` until the exit transition ends (`onoutroend` tells `SheetLayer`); switching straight to another sheet replaces the old one at once. No `.leave` / `.still` class, no timer.
- Open with `openSheet(name)`, close with `closeSheet()` (`components/ui/sheets.ts`; `SheetName` is the literal union).
- A sheet renders the children of `.sheet`: the body and the footer button as a direct child (the CSS relies on it).
- **Confirmations** are `components/ui/ConfirmSheet.svelte` (title, text, confirm / cancel labels, `onconfirm`, `onclose`); `AskSheet` feeds it from `ask(title, text, button, fn)` (`stores/ask.svelte.ts`). Every confirm prompt goes through `ask()`; a yes/no prompt is not a new sheet.
- The player-title suggestions `<datalist id="ttls">` are `components/players/TitleList.svelte`, mounted into `<body>` once by `App.svelte`. The categories note shakes through `nudge` (`components/categories/nudge.svelte.ts`), which `start()` bumps when no category is selected.

## Handlers live with their logic
- players → `stores/players.svelte.ts` (avatar builder choices, dice, photo, add, remove + undo; the player the builder sheet edits is `avatarEdit.i` in `stores/avatar-edit.svelte.ts`; the row transitions are `components/players/row-motion.ts`, used by `PlayersSheet`). The home screen has 5 `.sum` rows (Jucători, Grupuri, Categorii, Reguli, Joacă online `#ol0`); after a played game "Revanșă" is a pill on the Jucători row while the table is unchanged (`RematchCard` only when it differs; regenerate the setup goldens). The players sheet scrolls only its list (`.plscroll`); the name suggestions (`components/players/name-suggestions.ts`), "Adaugă jucător" and "Gata" are pinned below it (`.pdock`). The title input is hidden until the row's pencil is tapped, and Enter in a name or title field goes to the next player or adds one (`nextPlayer`). The chips show people who played recently: `state.rn` (saved key `rn`, filled by `rememberNames()` in `start()`), then the last game and saved groups; common names only fill in when fewer than 4 real names exist
- groups → `components/groups/groups.ts` (open, save, rename, play, load, delete, standings, awards)
- rules → `components/rules/rules-ui.ts`
- settings → `components/settings/settings.ts` (theme, accent, reveal, card design, tick style, switches, volume)
- categories → `components/categories/category-ui.ts`
- word lists / custom words → `stores/wordlists.svelte.ts`
- online → `components/online/online.ts`
- Handlers never take DOM elements and never touch classes. Pop / bump / icon effects live in the owning component as `class:pop={flash.on}` with a `Flash` (`components/ui/flash.svelte.ts`: a short-lived `$state` flag; `fire()` restarts the CSS animation; `new Flash(0)` stays on until `clear()`; the category tiles need that because the CSS animates `.cat:not(.pop)`).
- Sparks (`sparkBurst`) are called from the component with a `bind:this` element. `flushSync()` in a handler is only for focusing DOM that depends on the state just changed.
- Reusable pieces take callbacks as props: `Stepper` (`onchange`), `Segmented` (`onpick`, or `bind:value`), `Chips` (`onpick`), `SwitchRow` / `Switch` (`onchange`). String keys are typed (`SheetName`, `OptionKey` in `settings.ts`).

## Small UI components (`components/ui/`)
- `Panel` (`.panel`; `class` adds `pad` / `pl`; `tag="section"`).
- `Row` (`.cr`: `icon`, `name`, `description`, a `control` snippet, bindable `iconEl`; `fx` / `fxOff` / `onfxend` for the icon classes `fx-snd` / `fx-vb` / `fx-off`).
- `Switch` (`role="switch"`, `aria-checked`, `checked` is `$bindable`, `onchange`, `hook` = the `data-a` styling hook).
- `Segmented` (`options`, `value` `$bindable`, `onpick(value)`, `pop` pops the tapped button; keeps `--i` for the sliding pill and sets `--n` (column count, CSS default 4) only for 5 or more options).
- `Sheet`, `ConfirmSheet`, `Toast`. `sheets/SwitchRow` = `Row` + `Switch` (`fx="snd" | "vb"`; `onchange()` takes no arguments). `sheets/Chips` is the chip row.

## Toasts
- `toast(message, { action, onaction })` (`components/ui/toast.svelte.ts`) puts one entry in the reactive `toasts` array (a new toast replaces the old one) and removes it after 5 s; `dismissToast()` removes it at once (used by the player-removal undo).
- `Toast.svelte` is mounted once by `App.svelte` into `<body>`, outside `#app`, so the undo button stays clickable while a sheet makes `#app` inert. It renders the newest entry in `<div id="toast" role="status" aria-live="polite">` with `.tmsg` / `.tbtn` / `.tbar`. The message is text; there is no HTML string in the toast path.

## Markup conventions
- **Summaries are markup**: `SummaryCard` takes its content as children (`<SummaryCard …><AvatarStack …/>{n} jucători</SummaryCard>`); the home screen's rows and chips are written in `SetupScreen.svelte`. Plain-text helpers over `state` (`sum()`, `lbl()`, `rv()`, `catNote()`, `cuTxt()`) are fine inside `{…}`.
- Never mutate state inside a template expression (`currentWordLists()` creates the group's list array; use `readWordLists()` in templates).
- **Style hooks**: the CSS still targets two attributes, so keep `data-a="rm"` on the player-remove button and `data-a="troll"` on the troll switch. They are styling hooks only; nothing reads them.
- Whitespace between inline elements is significant: where there must be none, write `</a\n  ><b>` so Svelte does not insert a space.


## Where things live
| Folder | Contents |
|---|---|
| `src/lib/views/` | One `.svelte` component per screen plus a `.ts` with its logic |
| `src/lib/game/` | engine (start/end), session (quit / new game / rematch), scoring (group stats), twists, questions, intruders, drama, wheel, tension, simvote, twins, relaxed, list-share, types |
| `src/lib/stores/` | `state`, `round`, `talk` (countdown), groups, word lists, players helpers, avatar-edit, ask, nav, list-share |
| `src/lib/storage/` | localStorage key + the autosave effect |
| `src/lib/data/` | word lists (`words/<category>.ts`), questions, card designs, icons, constants (`INK`, `FILLS`) |
| `src/lib/components/**` | Svelte components next to the `.ts` files that own their handlers: `ui/`, `layout/{Background,Hero,QuestionMarks,TopBar,StepDots,QuitBar}`, `players/{Avatar,AvatarStack,PlayerTitle,avatar-parts.ts}` (the builder sheet is `sheets/AvatarSheet.svelte`, its state `stores/avatar-edit.svelte.ts`), `game/{Card,CardBack,TimerRing,TalkControls,VoiceButton,QuestionCard,TwistCard,TwistNote,NextDesignNote,FirstWheel,RevealDrama,TalkDim,peek-guard}`, `groups/`, `setup/SummaryCard`, `intro/slides/*`, `sheets/`, `debug/`. No empty placeholder files exist. |
| `src/lib/online/` | online client (see Online play) |
| `src/lib/i18n/` | `ro.ts`, `en.ts`, `core.ts`, `index.svelte.ts` |
| `src/lib/audio/`, `voice/` | Web Audio synth, SFX, haptics, voice host (speechSynthesis) |
| `src/lib/styles/` | CSS in cascade order: tokens → base → motion → themes → card-designs → performance |
| `server/` | the online game server (Cloudflare Durable Object via `partyserver`), with its own tests in `server/tests/` |
| `static/` | `audio/` (tick.mp3 / tock.mp3), `manifest.json`, `icons/` |
| `tests/unit/` | vitest (jsdom): pure-module tests, `boot.smoke.test.ts` (plays a full round), `mountview.test.ts` (go()/App lifecycle), `setup.behaviour`, `intro.behaviour`, `screens.behaviour` (pass, vote, tally, reveal, scoreboard), `avatars`, `rules.timer`, and **golden DOM tests** (`setup.golden.test.ts` vs `tests/golden/*.html`, mounting `App` and calling `go("setup")`; `intro.golden.test.ts` compares the component with the original string template kept in the test). Shared harness: `tests/unit/helpers/{screen,dom}.ts` (`installShell()` also stubs `getAnimations`). |
| `tests/e2e/` | Playwright; `round.spec.ts` is still an empty `test.skip` |

## Stylesheets (`src/lib/styles/`, imported in this order by `src/routes/+layout.svelte`; later wins)
`fonts.css`, `tokens.css` (CSS variables), `base.css` (layout, screens, reduced motion, skyline, `.gate`), `features.css` (card privacy, vote drama, wheel, simultaneous vote, relaxed text, list sharing), `shell.css` (installed-app title bar, iOS status bar, online presence), `motion.css` (keyframes, `.bgq`), `sheets.css` (bottom sheets and what is inside them), `themes.css` (themes, accents, home sizing), `card-designs.css`, `performance.css` (lite mode, last overrides). Grep the class name instead of reading a stylesheet.
