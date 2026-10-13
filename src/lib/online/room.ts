/** Pure helpers for online play: codes, URLs, the saved seat, and mapping the app's settings to the server's. */
import type { MessageKey } from "#lib/i18n/ro.ts";
import type { Settings } from "./protocol.ts";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/** Keeps A-Z and 0-9 only, upper-cased, at most 6 characters (what the code field allows while typing). */
export const normalizeCode = (input: string): string => input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
export const isValidCode = (code: string): boolean => CODE_RE.test(code);

/** The game server's host (no scheme), from the build-time env var VITE_PARTY_HOST. null = online play is off. */
export function serverHost(env: Record<string, unknown> | undefined = import.meta.env): string | null {
  const raw = env?.VITE_PARTY_HOST;
  if (typeof raw !== "string") return null;
  const host = raw.trim().replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
  return host || null;
}

/**
 * True only for a host that IS a local or private-network address (with an optional :port): "localhost", "[::1]" or a
 * complete dotted IPv4 address in 127/8, 10/8, 172.16/12 or 192.168/16. A public name that merely starts like one
 * ("localhost.evil.com", "10.example.com") is not local, so it is always reached over https / wss.
 */
export function isLocal(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/:\d{1,5}$/, "");
  if (h === "localhost" || h === "[::1]") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if (a > 255 || b > 255 || c > 255 || d > 255) return false;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export const httpUrl = (host: string, path: string): string => `${isLocal(host) ? "http" : "https"}://${host}${path}`;
export const wsUrl = (host: string, code: string): string => `${isLocal(host) ? "ws" : "wss"}://${host}/parties/game/${code}`;

export const joinLink = (origin: string, code: string): string => `${origin.replace(/\/+$/, "")}/online/${code}`;

/** Finds a room code in a link, a path ("/online/ABCDEF"), "?room=ABCDEF" or a bare code. null if there is none. */
export function codeFromText(text: string): string | null {
  const t = text.trim();
  const m = /\/online\/([A-Za-z0-9]{6})(?:[/?#]|$)/.exec(t) ?? /[?&]room=([A-Za-z0-9]{6})(?:&|#|$)/.exec(t) ?? /^([A-Za-z0-9]{6})$/.exec(t);
  if (!m) return null;
  const code = m[1].toUpperCase();
  return isValidCode(code) ? code : null;
}

/**
 * Finds a room link in what another app shared to Intrus (the manifest's `share_target` opens `/?title=&text=&url=`).
 * Only real links count ("/online/ABCDEF" or "?room=ABCDEF"), never a bare 6-letter word, so sharing some ordinary text
 * cannot open the join sheet by accident.
 */
export function codeFromShare(search: string): string | null {
  const q = new URLSearchParams(search);
  for (const key of ["url", "text", "title"]) {
    const value = q.get(key);
    const code = value && value.trim().length > 6 ? codeFromText(value) : null;
    if (code) return code;
  }
  return null;
}

/* ---- the saved seat (so a refresh or a dropped connection comes back to the same player) ---- */
export interface Session {
  code: string;
  playerId: string;
  token: string;
}
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export const SESSION_KEY = "intrus.online.session";
/** A saved seat older than this is dead anyway (the server deletes an empty room after 30 minutes): never resume it. */
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
export const NAME_KEY = "intrus.online.name";

const defaultKv = (): KV | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function loadSession(kv: KV | null = defaultKv(), now = Date.now()): Session | null {
  try {
    const raw = kv?.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session> & { at?: unknown };
    const valid = typeof s.code === "string" && isValidCode(s.code) && typeof s.playerId === "string" && typeof s.token === "string" && s.playerId && s.token;
    if (!valid) return null;
    if (typeof s.at === "number" && now - s.at > SESSION_TTL_MS) {
      clearSession(kv); // an old seat: forget it instead of offering it again
      return null;
    }
    return { code: s.code!, playerId: s.playerId!, token: s.token! };
  } catch {
    return null;
  }
}
/** Saves the seat with the time it was last confirmed by the server (a seat saved before this field existed counts as fresh once). */
export function saveSession(s: Session, kv: KV | null = defaultKv(), now = Date.now()): void {
  try {
    kv?.setItem(SESSION_KEY, JSON.stringify({ ...s, at: now }));
  } catch {
    /* storage full or blocked: the game still works, only reconnecting after a refresh does not */
  }
}
export function clearSession(kv: KV | null = defaultKv()): void {
  try {
    kv?.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
export function loadName(kv: KV | null = defaultKv()): string {
  try {
    return (kv?.getItem(NAME_KEY) ?? "").slice(0, 24);
  } catch {
    return "";
  }
}
export function saveName(name: string, kv: KV | null = defaultKv()): void {
  try {
    kv?.setItem(NAME_KEY, name.slice(0, 24));
  } catch {
    /* ignore */
  }
}

/** True when a state message is newer than the last one applied. */
export const isNewer = (lastRev: number, rev: number): boolean => rev > lastRev;

/** Server error code -> the message key to show. Unknown codes get the generic message. */
const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  "no-room": "errNoRoom",
  taken: "errTaken",
  "bad-ticket": "errBadTicket",
  full: "errFull",
  "in-progress": "errInProgress",
  "bad-token": "errBadToken",
  "rate-limited": "errRateLimited",
  "not-host": "errNotHost",
  "not-asker": "errNotAsker",
  "too-few": "errTooFew",
  "no-word": "errNoWord",
  "already-in-room": "errAlreadyIn",
  "bad-phase": "errBadPhase",
  "not-revealed": "errBadPhase",
  "too-large": "errTooLarge",
  internal: "errInternal"
};
export const errorKey = (code: string): MessageKey => ERROR_KEYS[code] ?? "errGeneric";

/** Errors after which this seat or room is gone for good (the client stops and shows the message). */
export const FATAL_ERRORS: readonly string[] = ["no-room", "taken", "bad-ticket", "full", "in-progress", "bad-token"];

/* ---- the app's own settings -> what the server wants ---- */
const MINUTES = [0, 1, 2, 3, 5] as const;

/** The settings of this device that online play uses. Everything after `hint` is optional so older callers keep working. */
export interface OnlineApp {
  cats: readonly string[];
  k: number;
  tm: number;
  hint: unknown;
  tw?: boolean;
  qm?: boolean;
  troll?: boolean;
  twn?: boolean;
  kn?: boolean;
  /** "Roata începătorului": the host's switch for the opening wheel. Only an explicit `false` turns it off (older callers don't pass it). */
  wh?: boolean;
  /** Custom words switched on, and the list as the app saves it: "word|category|hint, word, ...". */
  cu?: boolean;
  custom?: string;
}

/** The host's own words as the server wants them (one "word|category|hint" string each); empty while the switch is off. */
export function customWordsFromApp(app: Pick<OnlineApp, "cu" | "custom">): string[] {
  if (!app.cu) return [];
  return String(app.custom ?? "")
    .split(",")
    .map((x) => x.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 100);
}

/**
 * Only the settings the server understands are sent. `known` is the list of real category names (the custom-words
 * pseudo-category and anything stale are dropped); an empty result means "all categories" on the server, or just the
 * host's own words when there are some. The game modes (twists, questions, troll rounds, twin words, known partners)
 * are only switches here: the server does the dealing, because it holds every secret.
 */
export function settingsFromApp(
  app: OnlineApp,
  known?: readonly string[]
): {
  cats: string[];
  imposters: number;
  minutes: (typeof MINUTES)[number];
  hint: Settings["hint"];
  lang: "ro";
  tw: boolean;
  qm: boolean;
  troll: boolean;
  twn: boolean;
  kn: boolean;
  wh: boolean;
  customName: string;
  customWords: string[];
} {
  const nearest = MINUTES.reduce((best, m) => (Math.abs(m - app.tm) < Math.abs(best - app.tm) ? m : best), MINUTES[0]);
  const hint: Settings["hint"] = app.hint === "cat" ? "category" : app.hint === "rel" ? "related" : app.hint === "none" ? "none" : "letter";
  const cats = (known ? app.cats.filter((c) => known.includes(c)) : [...app.cats]).slice(0, 64);
  const customWords = customWordsFromApp(app);
  // Twin words and known partners exclude each other here, like on this device (the server also never mixes them).
  const twn = !!app.twn;
  return {
    cats,
    imposters: Math.min(12, Math.max(1, Math.trunc(app.k) || 1)),
    minutes: nearest,
    hint,
    lang: "ro",
    tw: !!app.tw,
    qm: !!app.qm,
    troll: !!app.troll,
    twn,
    kn: !!app.kn && !twn,
    wh: app.wh !== false,
    customName: customWords.length ? "Personalizat" : "",
    customWords
  };
}

/** Local-only features. They exist in the pass-and-play game but are NOT part of online play yet. */
export const ONLINE_UNSUPPORTED = ["olFeatGroups"] as const satisfies readonly MessageKey[];

/** Keys naming the unsupported features that are switched on in this device's settings (so the host knows they will be ignored). */
export function ignoredFeatures(app: { gid: string | null } & Partial<Record<"tw" | "qm" | "troll" | "cu", boolean>>): MessageKey[] {
  const out: MessageKey[] = [];
  if (app.gid) out.push("olFeatGroups");
  return out;
}
