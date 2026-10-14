/** Shared types of the pure room logic. No I/O and no framework imports on purpose. */

export type Lang = "ro" | "en";
export type Phase = "lobby" | "round" | "scores" | "ended";
export type Hint = "category" | "letter" | "related" | "none";
/** "troll" is only for the everybody-is-an-intruder round: nobody scores. */
export type Outcome = "caught" | "guessed" | "escaped" | "troll";
export type TimerAction = "start" | "pause" | "resume" | "add";

/** A word pack. Injected by the caller so this module never imports the client's data files. */
export interface WordPack {
  id: string;
  name: Record<Lang, string>;
  words: Record<Lang, string[]>;
  /** Twin-word pairs (Romanian only for now): the "similar word" pairs of this category. */
  pairs?: [string, string][];
}

export interface Player {
  id: string;
  name: string;
  /** Avatar builder look code (integer 0 .. LOOK_MAX, valid per isLookCode). Drawn avatars only: photos are never sent. */
  l: number;
  score: number;
  connected: boolean;
  /** When the socket dropped (ms). null while connected, and for players who left on purpose. */
  disconnectedAt: number | null;
  /** Left on purpose: cannot rejoin and is removed at the next sweep (kept only while a round is running, for scoring). */
  left: boolean;
  /** Private rejoin credential. Never part of PublicState. */
  token: string;
  /** The client's create/join nonce (see protocol.ts): lets a repeated login find this seat. Never part of PublicState. */
  nonce?: string;
}

export interface Settings {
  cats: string[];
  imposters: number;
  minutes: number;
  hint: Hint;
  lang: Lang;
  customName: string;
  /** Game twists (a round may get one: whisper, reverse, double agent, ...). */
  tw: boolean;
  /** Question mode: players ask each other questions during the discussion. */
  qm: boolean;
  /** Troll rounds: now and then everybody is an intruder. */
  troll: boolean;
  /** Twin words: the intruders get a similar word and are not told. */
  twn: boolean;
  /** Intruders who know each other (needs 2+ intruders and 6+ players). */
  kn: boolean;
  /** The opening wheel that picks who talks first (the host's switch; on unless the host turns it off, and on for rooms saved before it existed). */
  wh: boolean;
}

export interface Vote {
  picks: Record<string, string>;
  revealed: boolean;
}

/** Everything about the running round. Never included in PublicState. */
export interface Current {
  imposterIds: string[];
  playerIds: string[];
  category: string;
  decoy: string | null;
  word: string;
  hint: Hint;
  vote: Vote | null;
  /** Players who have looked at their card at least once. */
  seen: string[];
  /** Set when the host starts the discussion: who starts, when (server clock, ms) the shared wheel starts to turn, and whether there is a wheel at all (the room's `wh` switch, fixed for the round). */
  talk: { starterId: string; startAt: number; wheel: boolean } | null;
  /** True once the host has revealed the intruders (only then does PublicState carry the `reveal` block). */
  revealed: boolean;
  /** Troll round: everybody is an intruder and nobody scores. */
  troll: boolean;
  /** Twin words: the similar word the intruders got (they are not told they are intruders). */
  twin: string | null;
  /** The round's twist id (see game/twist-rules.ts), or null. */
  twist: string | null;
  /** Double agent twist: the civilian who got `word2`. */
  agentId: string | null;
  word2: string | null;
  /** "Voce de personaj" twist: index into PERSONAS (game/twist-rules.ts) of the voice the table talks in, else null. */
  persona: number | null;
  /** Intruders know each other (each intruder's role lists the others). */
  known: boolean;
  /** The hint the host wrote for this custom word, or null. */
  customHint: string | null;
  /** How many intruders were dealt before a twist added one. */
  baseIntruders: number;
  /** Question mode, once the discussion has started: who asks and the current question. `deck` is what is left to draw. */
  question: { askerId: string; dir: 1 | -1; q: string; n: number; deck: string[] } | null;
}

export type TimerState = { endsAt: number } | { remainingMs: number };

export interface Room {
  code: string;
  /** null only when the last player left on purpose. */
  hostId: string | null;
  /** The host displaced by the grace timeout. May take the host role back (see rejoinRoom). */
  formerHostId: string | null;
  /** True once the interim host did a host action, which ends the former host's claim. */
  interimActed: boolean;
  phase: Phase;
  players: Player[];
  settings: Settings | null;
  /** The host's own word list. Kept server-side, never broadcast. */
  customWords: string[];
  /** Recently dealt words, oldest first. */
  used: string[];
  round: number;
  lastImposterIds: string[];
  /** The twist of the previous round (never twice in a row). */
  lastTwist: string | null;
  timer: TimerState | null;
  current: Current | null;
}

/** The private role of one player. */
export interface Role {
  isIntruder: boolean;
  word: string | null;
  /** An intruder only gets the category when the hint mode is "category" (everyone else always does). */
  category: string | null;
  /** An intruder only gets the decoy when the hint mode is "related" (else null). */
  decoy: string | null;
  hint: Hint;
  /** First letter of the word, only for an intruder in a round whose hint is "letter" (else null). */
  letter: string | null;
  /** "Intruders who know each other": the other intruders of an intruder (ids), else empty. */
  mates: string[];
  /** The hint written for a custom word (only an intruder gets it), else null. */
  customHint: string | null;
}

export interface TimerView {
  status: "running" | "paused" | "up";
  remainingMs: number;
}

export type VoteView =
  | { revealed: false; voted: string[]; picks: null; tally: null }
  | { revealed: true; voted: string[]; picks: Record<string, string>; tally: Record<string, number> };

/** The discussion has started: who starts, how long ago (negative: in how long) the shared wheel starts as of this broadcast, and whether the round has a wheel (false: the starter is simply announced). */
export interface TalkView {
  starterId: string;
  sinceMs: number;
  wheel: boolean;
}

/** What the host revealed at the end of the round. Present ONLY after the host reveals (never during the round before that). */
export interface RevealView {
  intruderIds: string[];
  word: string;
  /** The similar word the intruders got, in a twin-words round, else null. */
  twin: string | null;
  /** A troll round: everybody was an intruder. */
  troll: boolean;
  /** The twist, including the secret ones (double agent, extra intruder), else null. */
  twist: string | null;
  /** Double agent: who got the related word, and which. */
  agentId: string | null;
  word2: string | null;
  /** How many intruders there were before an "extra intruder" twist. */
  baseIntruders: number;
}

/** Question mode: who is asking and the question (never secret). */
export interface QuestionView {
  askerId: string;
  q: string;
  /** Counts the questions drawn so far; a draw that names an older `n` is a stale tap and does nothing. */
  n: number;
}

/** Broadcast-safe snapshot: no word, decoy, intruders, tokens or internal flags. */
export interface PublicState {
  code: string;
  hostId: string | null;
  phase: Phase;
  round: number;
  settings: Settings | null;
  timer: TimerView | null;
  players: { id: string; name: string; l: number; score: number; connected: boolean }[];
  vote: VoteView | null;
  /** Who has looked at their card (null outside a round). */
  seen: string[] | null;
  /** Who was dealt into this round (null outside a round). A player who was away at the deal, or arrived later, only watches. */
  dealt: string[] | null;
  talk: TalkView | null;
  /** The twist shown to everybody on the discussion screen (the secret ones come only with the reveal). */
  twist: string | null;
  /** The persona of the "Voce de personaj" twist (an index into PERSONAS), shown together with the twist; null for every other round. */
  persona: number | null;
  question: QuestionView | null;
  reveal: RevealView | null;
}

/** Options a client may send with "start". The word is never client-chosen. */
export interface StartOptions {
  imposters?: unknown;
  hint?: unknown;
}

/** Context passed in by the caller: all time and randomness come from here, so everything is testable. */
export interface Ctx {
  packs: readonly WordPack[];
  now: number;
  rng?: () => number;
}
