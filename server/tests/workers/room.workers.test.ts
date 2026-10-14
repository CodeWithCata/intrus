/**
 * Real-runtime tests of the Game Durable Object (see ../../vitest.workers.config.ts). They cover what the fake-host
 * tests in ../session.test.ts cannot: the real WebSocket upgrade, Origin check, routing, SQLite-backed storage and alarms.
 * Assumes the partyserver internals (room id = idFromName(code)).
 */
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const ORIGIN = "https://app.test";
const HOST = "https://party.test";

let counter = 0;
/** A fresh valid room code per test (6 characters from the allowed alphabet). */
const newCode = (): string => "TEST" + "ABCDEFGHJKLMNPQRSTUVWXYZ"[counter++ % 24] + "2";

interface Msg {
    type: string;
    [k: string]: unknown;
}

async function connect(code: string, origin: string | null = ORIGIN) {
    const headers: Record<string, string> = { Upgrade: "websocket" };
    if (origin) headers.Origin = origin;
    const res = await exports.default.fetch(`${HOST}/parties/game/${code}`, { headers });
    if (res.status !== 101) return { status: res.status } as const;
    const ws = res.webSocket!;
    ws.accept();
    const inbox: Msg[] = [];
    const raw: string[] = [];
    ws.addEventListener("message", e => {
        const text = String(e.data);
        raw.push(text);
        if (text !== "pong") inbox.push(JSON.parse(text) as Msg);
    });
    const api = {
        status: 101,
        ws,
        inbox,
        raw,
        send: (m: unknown) => ws.send(typeof m === "string" ? m : JSON.stringify(m)),
        async waitFor<T extends string>(type: T, from = 0): Promise<Msg & { type: T }> {
            for (let i = 0; i < 200; i++) {
                const hit = inbox
                    .slice(from)
                    .filter(m => m.type === type)
                    .at(-1);
                if (hit) return hit as Msg & { type: T };
                await new Promise(r => setTimeout(r, 10));
            }
            throw new Error(`timed out waiting for "${type}"; got: ${inbox.map(m => m.type).join(", ")}`);
        },
        close: () => ws.close(1000, "test")
    };
    return api;
}

async function newTicket(): Promise<{ code: string; ticket: string; expires: number }> {
    const res = await exports.default.fetch(`${HOST}/api/new-code`, { method: "POST", headers: { Origin: ORIGIN } });
    expect(res.status).toBe(200);
    return (await res.json()) as { code: string; ticket: string; expires: number };
}

async function createRoom(name = "Host") {
    const { code, ticket, expires } = await newTicket();
    const host = await connect(code);
    if (host.status !== 101) throw new Error("upgrade failed");
    host.send({ type: "create", name, ticket, expires });
    const created = await host.waitFor("created");
    return { code, host, created };
}

async function joinRoom(code: string, name: string) {
    const c = await connect(code);
    if (c.status !== 101) throw new Error("upgrade failed");
    c.send({ type: "join", name });
    const joined = await c.waitFor("joined");
    return { c, joined };
}

const stub = (code: string) => env.Game.get(env.Game.idFromName(code));

describe("HTTP and upgrade rules", () => {
    it("refuses a missing or foreign Origin, a malformed code, and plain HTTP into a room", async () => {
        const code = newCode();
        expect((await connect(code, "https://evil.example")).status).toBe(403);
        expect((await connect(code, null)).status).toBe(403);
        expect((await connect("abc", ORIGIN)).status).toBe(404);
        expect((await connect("ABCDE0", ORIGIN)).status).toBe(404);
        expect((await exports.default.fetch(`${HOST}/parties/game/${code}`, { headers: { Origin: ORIGIN } })).status).toBe(404);
        expect((await exports.default.fetch(`${HOST}/nothing`)).status).toBe(404);
    });

    it("/api/new-code needs an allowed origin and POST", async () => {
        expect((await exports.default.fetch(`${HOST}/api/new-code`, { method: "POST", headers: { Origin: "https://evil.example" } })).status).toBe(403);
        expect((await exports.default.fetch(`${HOST}/api/new-code`, { method: "GET", headers: { Origin: ORIGIN } })).status).toBe(405);
        const { code } = await newTicket();
        expect(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)).toBe(true);
    });
});

describe("a room over a real WebSocket", () => {
    it("create needs the server's ticket, and a code can only be created once", async () => {
        const { code, ticket, expires } = await newTicket();
        const forger = await connect(code);
        if (forger.status !== 101) throw new Error("upgrade failed");
        forger.send({ type: "create", name: "X", ticket: "forged", expires });
        expect((await forger.waitFor("error")).code).toBe("bad-ticket");

        const host = await connect(code);
        if (host.status !== 101) throw new Error("upgrade failed");
        host.send({ type: "create", name: "Host", ticket, expires });
        expect((await host.waitFor("created")).isHost).toBe(true);

        const squatter = await connect(code);
        if (squatter.status !== 101) throw new Error("upgrade failed");
        squatter.send({ type: "create", name: "Squat", ticket, expires });
        expect((await squatter.waitFor("error")).code).toBe("taken");
    });

    it("three players play the start: every player gets only their own role and the intruder never sees the word", async () => {
        const { code, host } = await createRoom("Ana");
        const b = await joinRoom(code, "Bob");
        const c = await joinRoom(code, "Cara");
        host.send({ type: "start", imposters: 1, word: "HACK" });
        const roles = await Promise.all(
            [host, b.c, c.c].map(async p => ({ p, role: (await p.waitFor("role")).role as { isIntruder: boolean; word: string | null } }))
        );
        expect(roles.filter(r => r.role.isIntruder)).toHaveLength(1);
        const word = roles.find(r => !r.role.isIntruder)!.role.word!;
        expect(word).not.toBe("HACK");
        const intruder = roles.find(r => r.role.isIntruder)!.p;
        expect(intruder.raw.join("\n").includes(word)).toBe(false);
        for (const { p } of roles) expect(p.raw.join("\n").includes('"imposterIds"')).toBe(false);
    });

    it("answers the plain-text heartbeat", async () => {
        const { host } = await createRoom();
        host.send("ping");
        for (let i = 0; i < 100 && !host.raw.includes("pong"); i++) await new Promise(r => setTimeout(r, 10));
        expect(host.raw.includes("pong")).toBe(true);
    });
});

describe("storage, alarms and restarts", () => {
    it("the room is written to Durable Object storage", async () => {
        const { code } = await createRoom("Ana");
        const saved = await runInDurableObject(stub(code), async (_instance, state) =>
            state.storage.get<{ room: { phase: string; players: unknown[] }; rev: number }>("room")
        );
        expect(saved?.room.phase).toBe("lobby");
        expect(saved?.room.players).toHaveLength(1);
        expect(saved?.rev).toBeGreaterThan(0);
    });

    it("a dropped player's seat is held (the alarm runs but the grace period has not passed)", async () => {
        const { code } = await createRoom("Ana");
        const b = await joinRoom(code, "Bob");
        b.c.close();
        await new Promise(r => setTimeout(r, 50));
        expect(await runDurableObjectAlarm(stub(code))).toBe(true); // an alarm was scheduled for the grace expiry
        const saved = await runInDurableObject(stub(code), async (_i, state) => state.storage.get<{ room: { players: { connected: boolean }[] } }>("room"));
        expect(saved?.room.players).toHaveLength(2);
        expect(saved?.room.players.filter(p => p.connected)).toHaveLength(1);
    });

    it("after the object is reset (as after a crash or eviction) the room comes back from storage and the seat can be rejoined", async () => {
        const { code, host, created } = await createRoom("Ana");
        const { playerId, token } = created as unknown as { playerId: string; token: string };
        try {
            await runInDurableObject(stub(code), async (_i, state) => state.abort("test reset"));
        } catch {
            /* abort() throws by design */
        }
        host.close();
        await new Promise(r => setTimeout(r, 50));
        const back = await connect(code);
        if (back.status !== 101) throw new Error("upgrade failed");
        back.send({ type: "rejoin", playerId, token });
        expect((await back.waitFor("rejoined")).isHost).toBe(true);
    });
});
