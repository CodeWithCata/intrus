# Online play (client and server)

- Client in `src/lib/online/`: `socket.ts` (reconnecting WebSocket), `client.ts` (framework-free login / reconnect / state logic, unit-tested), `client.svelte.ts` (reactive `online` store + navigation: server round → `go("online")`, lobby / closed → `go("setup")`), `room.ts` (codes, links, saved seat, settings mapping, Romanian error texts), `qr.ts` (own QR encoder, byte mode, level M, versions 1–9), `protocol.ts` (types only; schemas live in `server/protocol.ts`).
- UI: `OnlineSheet.svelte` (create / join / lobby), `views/OnlineScreen.svelte` (round, vote, outcome, scores), route `/online/[room]` (invitation link: remembers the code, `boot()` opens the join sheet).
- Online play is off unless the build has `VITE_PARTY_HOST` (see `.env.example`).
- Game modes online (all server-side, so no phone ever holds a secret it should not): `Role` carries `mates` (known partners) and `customHint`; twin words make nobody an intruder (`isIntruder: false`, the intruders just hold the similar word); a troll round makes everybody an intruder and ends with outcome `troll` (no points); `PublicState.twist` shows a twist only once the discussion has started and never the secret ones (`ag`, `ex`: they come with the `reveal` block); `PublicState.question` is the shared question card (`question` message: `next` / `other`, host or the asker only). `server/tests/room-logic.test.ts` pins that none of this is public before the host reveals. An outcome is refused until the host has revealed (`not-revealed`), and a `question` draw carries the question counter `n` so a repeated tap is ignored. `PublicState.dealt` lists who was dealt into the round: anyone else (away at the deal, or back later) only watches, and the vote, the status rows and the wheel use that list. The socket probes a "open" connection on wake-up (`nudge()`), and `OnlineClient.nudge()` takes the saved seat again after the socket gave up.
- Server in `server/` : `party.ts` (`partyserver` Durable Object), `room-logic.ts` (a barrel; the rules are split into `room-core`, `room-members`, `room-vote`, `room-talk`, `room-settings`, `room-round`, `room-view`), `protocol.ts` (valibot schemas; valibot never reaches the client bundle), `session.ts`, `tickets.ts`, `origin.ts`, `limits.ts`, `http.ts`, `packs.ts`. Tests: `pnpm test` runs `server/tests/*.test.ts`; `pnpm test:workers` runs the workers pool.



## Rules that must hold
- The word, the decoy and who the intruders are never appear in any broadcast. `publicState()` in `server/room-view.ts` is a whitelist; keep it one.
- The host chooses the outcome and the points (the tally is only information). Making the server compute it from the votes would stop host cheating, but needs the owner's agreement first.
- Room codes use a 32-character alphabet without 0/O/1/I. Origin check: `server/origin.ts` (`ALLOWED_ORIGINS` in `server/wrangler.toml`, empty = fail closed; localhost origins only in `server/.dev.vars.example`).

## Hardening already done (do not undo; each has tests)
- Upgrades are refused by `refuseConnect()` in `server/http.ts`: only party `game`, only exact upper-case codes (one room, one name), only allowed origins, and a per-IP limit (`CONNECT_LIMITER` in `server/wrangler.toml`; optional binding).
- An intruder learns only what the hint mode promises (`roleFor` in `server/room-members.ts`): category for `category`, decoy for `related`, first letter for `letter`, nothing for `none`. `Role.category` is therefore nullable.
- A failed save reloads the stored room (`persist` in `server/session.ts`); the stored room carries `v` (`STATE_VERSION`) and a room from a newer version is dropped.
- create / join carry a client `nonce`; a repeat login (reconnect before the first answer) gets the same seat back (`takeSeat`, `playerByNonce`). The nonce is never public.
- The client forgets a saved seat after 6 h (`SESSION_TTL_MS` in `src/lib/online/room.ts`) and does not resume one when boot restored an unfinished local game.
- `netlify.toml`: a missing `/_app/*` file is a 404, listed before the catch-all (never the app shell under an immutable URL).

## Still open
1. CSP (`scripts/headers.mjs`) allows `'unsafe-inline'` scripts while seat tokens sit in localStorage. Move to `kit.csp` hash mode after a report-only trial on a real deploy (`CSP_REPORT_ONLY=1`).
2. Unverified platform assumptions: party name `game`, `hibernate`, `onAlarm`, `onBeforeRequest`, the wrangler `ratelimits` / SQLite blocks (including the new `CONNECT_LIMITER`). A wrong one is an outage, not a leak: run `wrangler deploy --dry-run` and a two-browser test before shipping.
3. `pnpm test:workers` cannot run (pool needs vitest ^4.1, repo is on vitest 5), so the Durable Object adapter in `server/party.ts` has no automated test.
