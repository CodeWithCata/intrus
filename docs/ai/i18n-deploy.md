# Translations, deploy, legacy names

## Translations
- `src/lib/i18n/`: `ro.ts` is the source of truth for keys; `en.ts` is typed `Record<MessageKey, string>` (a missing key does not compile); `core.ts` is pure (`interpolate`, `translate`, language storage); `index.svelte.ts` gives the reactive `t(key, params)` and `setLang()` (saved in `localStorage` under `intrus.lang`, default Romanian, Romanian is also the fallback).
- **Every new user-facing string is a key in both files and is used through `t()`.** Variables are `{name}` placeholders; write whole sentences per key, never join pieces.
- `tests/unit/i18n.test.ts` checks same keys, same placeholders, no empty strings, and that every `t("...")` in `src/` exists.
- Used through `t()` so far: the online-play UI, the pass gate and a few messages. Other screens still hold their Romanian inline (their keys, ported from the old app, are already in the dictionaries). Moving a screen = replace its inline text with `t()` calls using the existing key, and check its golden test still passes in Romanian.

## Deploying the frontend (Netlify)
`netlify.toml` builds with `pnpm build && node scripts/headers.mjs build`. `scripts/headers.mjs` writes `build/_headers` (CSP with `connect-src` limited to `VITE_PARTY_HOST`, no-cache for the shell / service worker / manifest / `/online/*`, one-year immutable cache for `/_app/immutable/*`). Netlify env vars: `VITE_PARTY_HOST` (game server host, no scheme), optionally `CSP_REPORT_ONLY=1` for a first deploy. The game server must list the site in `ALLOWED_ORIGINS` (`server/wrangler.toml`).


## Legacy short names
`cu*` = custom words ("cuvinte"), `rv*` = reveal, `wl*` = word lists, `g*` = groups, `sr` = rounds in the current series, `Avatar` = avatar svg component, `ic` → `icon()`, `lu` = last used custom list id.
