import * as RL from "../room-logic.ts";
import type { Ctx, Role, Room, WordPack } from "../types.ts";

export const NOW = 1_000_000;
export const SEC = 1000;

export const PACKS: WordPack[] = [
  { id: "food", name: { ro: "Mâncare", en: "Food" }, words: { ro: ["pâine", "brânză", "mere", "supă", "pui", "orez"], en: ["bread", "cheese", "apple", "soup", "chicken", "rice"] } },
  { id: "pets", name: { ro: "Animale", en: "Pets" }, words: { ro: ["câine", "pisică", "pește", "iepure", "papagal", "hamster"], en: ["dog", "cat", "fish", "rabbit", "parrot", "hamster"] } }
];

export const seqRng = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

export const ctx = (over: Partial<Ctx> = {}): Ctx => ({ packs: PACKS, now: NOW, rng: seqRng([0]), ...over });

/** A lobby with the host ("host") and n-1 players ("p1", "p2", ...). */
export function lobbyOf(n: number): Room {
  const room = RL.createRoom("ABCDE", "host", "Host");
  for (let i = 1; i < n; i++) RL.joinRoom(room, "p" + i, "Player " + i);
  return room;
}

/** A running round with n players, 1 intruder. */
export function roundOf(n: number, minutes = 3) {
  const room = lobbyOf(n);
  RL.updateSettings(room, "host", { imposters: 1, hint: "category", minutes, lang: "en" }, PACKS);
  const { roles } = RL.startRound(room, "host", { imposters: 1 }, ctx());
  return { room, roles };
}

export const intruderIds = (roles: Record<string, Role>): string[] =>
  Object.entries(roles).filter(([, r]) => r.isIntruder).map(([id]) => id);

/* ---- Phase 2 game modes: shared by room-modes.test.ts and room-view.test.ts ---- */

export const PAIR_PACKS: WordPack[] = PACKS.map((p, i) => (i === 0 ? { ...p, pairs: [["pâine", "covrig"]] as [string, string][] } : p));

/** A lobby with `n` players and the given settings; the host's own words / modes are part of the settings. */
export function modeLobby(n: number, settings: Record<string, unknown>, packs: WordPack[] = PACKS) {
  const room = lobbyOf(n);
  RL.updateSettings(room, "host", { lang: "ro", hint: "category", minutes: 2, ...settings }, packs);
  return room;
}

/** Everything a client could ever read before the host reveals, as one string. */
export const everythingPublic = (room: ReturnType<typeof lobbyOf>) => JSON.stringify(RL.publicState(room, NOW + 60 * SEC));
