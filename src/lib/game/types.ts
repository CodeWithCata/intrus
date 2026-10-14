/**
 * Shared types. State mirrors what is persisted in localStorage - never rename its keys (saved
 * games would break).
 */
/** A player. `a` is the legacy avatar index (0-47); `l` is the avatar builder's look code (see avatar-parts.ts); `ph` is an optional photo data URL. */
export interface Player {
    /** Name as typed (may be empty - see displayName()). */
    n: string;
    /** Legacy avatar index, 0-47. Kept in step with `l` when a legacy face matches, so older code still shows something sensible. */
    a: number;
    /** Avatar builder look code (bit-packed, 28 bits: 0 .. LOOK_MAX in avatar-parts.ts). Wins over `a`; a player without it looks as before. */
    l?: number;
    /** Photo (data URL) that replaces the drawn avatar. */
    ph?: string;
    /** Stable id used as the key in `Group.st.p`. */
    u?: string;
    /** Title shown next to the name (see PlayerTitle). */
    ti?: string;
}

/** All-time statistics of one player inside a group (see blankPlayerStats()). */
export interface PlayerStats {
    /** Rounds played. */
    r: number;
    /** Points. */
    pt: number;
    /** Rounds as intruder. */
    i: number;
    /** Rounds as civilian. */
    c: number;
    /** Intruder escapes. */
    e: number;
    /** Intruder guesses. */
    g: number;
    /** Votes cast. */
    vt: number;
    /** Votes that hit an intruder. */
    vr: number;
    /** Series won. */
    w: number;
}

/** A custom word list saved with a group. */
export interface GroupWordList {
    id: string;
    nm: string;
    w: string;
}

/** A saved group (team) with its statistics. */
export interface Group {
    id: string;
    /** Group name. */
    nm: string;
    pl: Player[];
    st: {
        /** Rounds played. */
        r: number;
        /** Series finished. */
        s: number;
        t: number;
        /** Per-player statistics, keyed by `Player.u`. */
        p: Record<string, PlayerStats>;
    };
    wl?: GroupWordList[];
    /** Id of the last custom list used. */
    lu?: string;
}

/** Snapshot of the last round, used by the rematch card. */
export interface Rematch {
    gid: string | null;
    k?: number;
    pl: Player[];
}

/** Every value state.sheet can take (one component per name in components/sheets/). */
export type SheetName = "help" | "set" | "players" | "avatar" | "cats" | "rules" | "online" | "groups" | "gstats" | "gname" | "lname" | "lshare" | "limport" | "ask";

export interface State {
    players: Player[];
    k: number;
    cats: string[];
    tm: number;
    hint: any;
    vol: number;
    ol: number;
    code: string;
    custom: string;
    cu: boolean;
    troll: boolean;
    snd: boolean;
    vb: boolean;
    lite: boolean;
    theme: string;
    acc: string;
    rv: string;
    rs: string;
    rb: string;
    cd: string;
    tk: string;
    rounds: number;
    hist: string[];
    /** Names of players who played recently (most recent first), for the quick-add chips of the players sheet. */
    rn?: string[];
    seen: boolean;
    scores: Record<string, any>;
    last: any[];
    sheet: SheetName | null;
    groups: Group[];
    gid: string | null;
    rc: Rematch | null;
    sr: number;
    tw: boolean;
    gn: string;
    ge: string | null;
    gv: string | null;
    gfrom: boolean;
    qm: boolean;
    vh: boolean;
    wl0: GroupWordList[];
    ln: string;
    nw: string;
    nc: string;
    nh: string;
    /** "Dramatism la vot": drumroll + staged reveal (default on). */
    dr: boolean;
    /** "Roata începătorului": spin the opening wheel before the discussion (default on). Online it is the host's switch, sent to the server. Still off in relaxed mode and with reduced motion. */
    wh: boolean;
    /** "Protecție la ochi indiscreți": the pass card also hides on tilt / shake / tab switch (default on for touch devices). */
    pv: boolean;
    /** "Ecran de predare": show the "Dă telefonul lui …" gate before each player's card (default on). Off = straight to the card. */
    gt: boolean;
    /** "Mod de vot": "seq" = one by one (default), "sim" = everybody at once on one screen. */
    vm: "seq" | "sim";
    /** "Cuvinte gemene": the intruders get a similar word and are not told. */
    twn: boolean;
    /** "Intruși care se cunosc": intruders see their partners on the pass screen. */
    kn: boolean;
    /** "Mod relaxat": bigger text, longer timers, gentle effects. */
    rx: boolean;
    /** Switch of the optional "Petrecere" word pack (default off). */
    pty: boolean;
    /** Version of the category list the saved `cats` was made for (see migrateCats). */
    cv: number;
    [k: string]: any;
}

/** The round being played (`round` in stores/ui.svelte.ts). Not persisted. */
export interface Round {
    word: string;
    cat: string;
    /** Indexes of the intruders (every player in a troll round). */
    intr: number[];
    troll: boolean;
    first: number;
    votes: number[];
    hint: string;
    /** Twist id (see TWISTS in game/twists.ts) or null. */
    tw: string | null;
    /** Vote being cast right now (vote screen). */
    pk?: number | null;
    /** Most voted players, set by the tally. */
    top?: number[];
    /** Double agent of the "ag" twist, and the related word they get instead of `word`. */
    da?: number;
    word2?: string;
    /** "Voce de personaj" twist: index into PERSONAS (game/twist-rules.ts) of the voice everybody talks in this round. */
    persona?: number;
    /** "Cuvinte gemene": the round was dealt with twin words (intruders hold `twin`, nobody is told). */
    tn?: boolean;
    /** The similar word the intruders got in a twin-words round. */
    twin?: string;
    /** "Intruși care se cunosc": the intruders of this round know each other. */
    kn?: boolean;
    /** The votes came from the simultaneous screen, so they are anonymous (`votes[i]` is not player i's vote). */
    anon?: boolean;
}
