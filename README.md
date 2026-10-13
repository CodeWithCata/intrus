# Intrus

SvelteKit 3 + Svelte 5 + TypeScript party game. AI agents: start with [AGENTS.md](./AGENTS.md).

```
pnpm install
pnpm dev        # development (online play is switched off: no game server)
pnpm dev:online # development WITH online play: starts the game server (8787) and the app (5173) together
pnpm dev:tunnel # development behind an ngrok tunnel: `ngrok http 5173`, then open the https URL (see below)
pnpm build      # static build (adapter-static)
pnpm check      # svelte-check
pnpm test       # vitest (unit + jsdom smoke test that plays a full round)
```

Dependencies are pinned to semver ranges (not `latest`) and `pnpm-lock.yaml` is committed. SvelteKit 3 and svelte-check need TypeScript 6, so `typescript` stays on `~6.0`; bump it only when Kit/svelte-check support 7.

SvelteKit 3 notes: configuration lives in `vite.config.ts` (`sveltekit({...})`, no `svelte.config.js`); `tsconfig.json` extends `$app/tsconfig`; app code is imported through the `#lib/*` subpath import declared in `package.json` (always with the real file extension, e.g. `#lib/stores/ui.svelte.ts`).

- `src/lib/boot.ts` starts the game (called from `src/routes/+layout.svelte`).
- The game is a single-screen state machine, so every sub-route redirects to `/`.
- Every screen and every bottom sheet is a Svelte component (see `docs/ai/architecture.md`).
- `src/lib/views/*` – screens (setup, intro, pass, talk, vote, tally, reveal, scoreboard); `src/lib/game/*` – engine, scoring, twists, questions.
- `static/audio/tick.mp3`, `tock.mp3` – cinematic timer sounds (previously inlined base64).

## Testing through ngrok

1. `pnpm dev:tunnel` (not plain `pnpm dev`: it points the hot-reload websocket at port 443, which is what a tunnel exposes).
2. In another terminal: `ngrok http 5173`. Open the `https://....ngrok-free.app` URL and click "Visit Site" on ngrok's warning page.
3. Online play from a phone needs the game server reachable too. `localhost:8787` means the phone itself, and an `https` page cannot open `ws://`. Run `ngrok http 8787`, put that host (no scheme) in `.env` as `VITE_PARTY_HOST`, restart `pnpm dev:tunnel`, and add the first tunnel's origin to `ALLOWED_ORIGINS` in `server/.dev.vars`.
4. Still spinning after an earlier visit? Clear the site data for the ngrok domain once (the service worker now removes itself on tunnel hosts, but an old copy may linger).

## Installed app (PWA)

What the app does once it is on a home screen. Everything below is declared in `static/manifest.json` or `src/app.html`; `tests/unit/pwa.test.ts` pins it.

- **No coloured bar.** `theme_color` and the `theme-color` meta follow the page (white, dark, noir), so the installed app's title bar (desktop) and status bar (phone) blend in. Only `background_color` is red: it is the launch screen, which the in-app splash continues.
- **Transparent title bar on desktop** (`display_override`: window-controls-overlay first). In the installed Chrome / Edge app the page runs under the title bar and shows through it; the minimise / maximise / close buttons float on top (`#tb` in `app.html` is the strip you drag the window by, rules at the end of `base.css`). Chrome adds a small toggle in the title bar to switch the overlay off. On Android the next entry applies: fullscreen, no status bar (swipe from the top edge to see the clock). Everything else gets a normal standalone window.
- **Launch images for iPhone and iPad** (`static/splash/*.png`, one `apple-touch-startup-image` per screen size). They are flat red on purpose: the in-app splash then draws INTRUS on the same red, so nothing jumps. A new device size needs a new file and a new `<link>` (the test checks that name, media query and pixel size agree).
- **Long-press shortcuts**: "Joc nou" (`/?shortcut=new`, asks before dropping a running round) and "Intră într-o cameră" (`/?shortcut=join`, opens the online sheet on the join tab). Handled by `utils/launch-intent.ts`.
- **Share target** (Android): sharing a room link to Intrus opens the join sheet with the code filled in (`codeFromShare` in `online/room.ts`). Plain text that is not a room link is ignored.
- **Icon badge** (`utils/app-badge.ts`): while the page is hidden in an online room, a new round or the results put a dot on the icon; it clears when the player returns. iOS shows badges only if notifications were allowed.
- **Connection toasts** (`utils/network-status.ts`): "offline" on the setup screen or in a room (never during a one-phone round), and "back online" after it.
- Already there before: Screen Wake Lock during rounds (`utils/wake-lock.svelte.ts`) and haptics at the timer end and in the reveal.

### Install-dialog screenshots

```
pnpm build && pnpm preview     # terminal 1
pnpm screenshots               # terminal 2: writes static/screenshots/*.png and adds "screenshots" to the manifest
```

### Auditing the PWA

Chrome DevTools: **Application → Manifest** lists problems and shows "Installability"; **Application → Service Workers** shows the worker. Lighthouse (Chrome DevTools → Lighthouse, or the command below) no longer has a separate PWA category, but its performance, accessibility, best-practices and SEO scores still matter.

```
pnpm build && pnpm preview     # terminal 1
pnpm lighthouse                # terminal 2: lighthouse on http://localhost:4173 (needs Chrome installed)
```

Run it on the HTTPS URL of the real deploy as well; an ngrok tunnel switches the service worker off on purpose, so audit the build, not the tunnel.
