/**
 * Which twist (if any) a round gets. Pure: no stores and no I/O, so the single-device game and the online server share it.
 * The 40% chance, the rule against repeating the last twist and the conditions of each twist live here and nowhere else.
 */

export const TWIST_IDS = ["sopt", "rev", "rep", "adj", "mima", "neg", "blitz", "dbl", "voc", "ag", "ex"] as const;
export type TwistId = (typeof TWIST_IDS)[number];

/** Twists that are a secret until the reveal (nobody is told about them during the round). */
export const HIDDEN_TWISTS: readonly string[] = ["ag", "ex"];

/** Twists that make no sense in question mode (they change how people describe the card). */
const NOT_WITH_QUESTIONS: readonly string[] = ["adj", "mima", "rep", "neg"];

/**
 * The characters of the "Voce de personaj" twist (id "voc"): the whole table talks in the same voice for the round.
 * The Romanian text is the identity (English is in i18n/labels.ts, like the twist names). The round stores only the INDEX
 * (`Round.persona` / `Current.persona`), so never reorder or remove entries: add new ones at the END.
 */
export const PERSONAS: readonly string[] = [
  "Crainic de știri",
  "Pirat",
  "Bunică supărată",
  "Comentator de fotbal",
  "Robot defect",
  "Povestitor de documentar",
  "Actor de telenovelă",
  "Vânzător de teleshopping",
  "Căpitan de avion",
  "Detectiv de film noir",
  "Vrăjitor bătrân"
];

/** A random persona (an index into PERSONAS). `rng` returns [0, 1). */
export function pickPersona(rng: () => number = Math.random): number {
  return Math.min(PERSONAS.length - 1, Math.floor(rng() * PERSONAS.length));
}

export const TWIST_CHANCE = 0.4;

export interface TwistContext {
  /** The twist of the previous round (never repeated back to back). */
  last: string | null;
  questions: boolean;
  /** The discussion has a timer (needed by Blitz). */
  timer: boolean;
  /** A twin-words round (no double agent then). */
  twin: boolean;
  players: number;
  intruders: number;
  /** How many other words of the same category exist (the double agent gets one of them). */
  related: number;
}

/** The twists this round could get, in table order. */
export function eligibleTwists(c: TwistContext): TwistId[] {
  const max = Math.max(1, (c.players - 1) >> 1);
  const civilians = c.players - c.intruders;
  return TWIST_IDS.filter(
    (id) =>
      id !== c.last &&
      (!c.questions || !NOT_WITH_QUESTIONS.includes(id)) &&
      (id !== "blitz" || c.timer) &&
      (id !== "ag" || (!c.twin && civilians >= 3 && c.related > 0)) &&
      (id !== "ex" || (c.intruders < max && civilians >= 3))
  );
}

/** Rolls the chance, then picks one of the eligible twists. `rng` returns [0, 1). Null = a plain round. */
export function pickTwist(c: TwistContext, rng: () => number = Math.random): TwistId | null {
  if (rng() >= TWIST_CHANCE) return null;
  const list = eligibleTwists(c);
  if (!list.length) return null;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}
