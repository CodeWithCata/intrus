/**
 * Repeatable measurements. A scenario (idle, open the settings sheet, scroll) is run with a set of
 * effects switched off and scored by "ms lost per second to late frames". The auto-profile runs it
 * for every experiment and ranks them by what they win back, so nobody has to judge by eye.
 */
import type { Monitor, RunResult } from "./metrics.ts";

export type ScenarioKind = "idle" | "sheet" | "scroll";

export interface Host {
    monitor: Monitor;
    openSheet(): void;
    closeSheet(): void;
    sheetOpen(): boolean;
    /** Hides (true) or shows the debugger's own UI, so it never skews a measurement. */
    ui(hidden: boolean): void;
}

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const frames = (n: number) =>
    new Promise<void>(r => {
        let i = n;
        const f = () => (--i <= 0 ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
    });

/** One run of a scenario on the screen that is showing now. */
export async function runScenario(host: Host, kind: ScenarioKind, ms: number, stress = 0): Promise<RunResult> {
    const m = host.monitor;
    m.stress = stress;
    let note: string | undefined;
    try {
        await frames(3);
        await sleep(200);
        if (kind === "sheet" && !host.sheetOpen()) {
            const rec = m.record();
            host.openSheet();
            await sleep(ms);
            const res = m.finish(rec);
            host.closeSheet();
            await sleep(450);
            return res;
        }
        if (kind === "sheet") {
            note = "a sheet was already open: measured idle";
        }
        if (kind === "scroll") {
            const el = document.scrollingElement as HTMLElement | null;
            const max = el ? el.scrollHeight - innerHeight : 0;
            if (el && max >= 40) {
                const prev = el.style.scrollBehavior;
                el.style.scrollBehavior = "auto";
                const rec = m.record();
                const t0 = performance.now();
                await new Promise<void>(done => {
                    const step = (t: number) => {
                        const p = (t - t0) / ms;
                        if (p >= 1) {
                            done();
                            return;
                        }
                        const k = (p * 2) % 2;
                        el.scrollTop = max * (k < 1 ? k : 2 - k);
                        requestAnimationFrame(step);
                    };
                    requestAnimationFrame(step);
                });
                el.scrollTop = 0;
                el.style.scrollBehavior = prev;
                return m.finish(rec);
            }
            note = "this screen does not scroll: measured idle";
        }
        const rec = m.record();
        await sleep(ms);
        return { ...m.finish(rec), note };
    }
    finally {
        m.stress = 0;
    }
}

/* ---------- finding the animations that run ---------- */

export interface SeenAnim {
    count: number;
    states: Set<string>;
}

interface Named extends Animation {
    animationName?: string;
}

/** Runs the scenario once and notes every CSS animation that is alive before, during and started by it. */
export async function scanAnimations(host: Host, kind: ScenarioKind, ms: number): Promise<{ seen: Map<string, SeenAnim>; run: RunResult }> {
    const seen = new Map<string, SeenAnim>();
    const entry = (n: string) => {
        let e = seen.get(n);
        if (!e) {
            e = { count: 0, states: new Set() };
            seen.set(n, e);
        }
        return e;
    };
    const snap = (tag: string) => {
        for (const a of document.getAnimations() as Named[]) {
            if (a.animationName) {
                const e = entry(a.animationName);
                e.count++;
                e.states.add(`${tag}: ${a.playState}`);
            }
        }
    };
    const onStart = (e: Event) => {
        const n = (e as AnimationEvent).animationName;
        if (n) {
            entry(n).states.add("started by the test");
        }
    };
    snap("before");
    document.addEventListener("animationstart", onStart, true);
    const mid = window.setTimeout(() => snap("during"), 200 + ms * 0.6);
    try {
        const run = await runScenario(host, kind, ms);
        snap("after");
        return { seen, run };
    }
    finally {
        clearTimeout(mid);
        document.removeEventListener("animationstart", onStart, true);
    }
}

/* ---------- auto-profile ---------- */

export interface ProfileItem {
    kind: "feature" | "anim";
    id: string;
    name: string;
}

export interface ProfileRow extends ProfileItem {
    run: RunResult;
    /** ms per second won back by switching it off (negative = it got worse), against the baselines measured just before and after it. */
    gain: number;
    /** Index in ProfileResult.bases of the baseline measured just before this run. */
    slot: number;
    significant: boolean;
}

export type ProfileStatus = "running" | "done" | "cancelled" | "smooth" | "no-css-gain";

export interface ProfileResult {
    status: ProfileStatus;
    scenario: ScenarioKind;
    ms: number;
    stress: number;
    budget: number;
    base: RunResult;
    baseEnd?: RunResult;
    /** Every baseline run, in order: one first, then one after every BRACKET experiments, and one at the end. */
    bases: RunResult[];
    /** Reference score: mean of the baselines. */
    ref: number;
    /** A gain below this is noise (a result is also judged against the drift of its own bracket). */
    threshold: number;
    /** Largest jump between two consecutive baselines: how steady the device was. */
    drift?: number;
    ceiling?: { run: RunResult; gain: number };
    rows: ProfileRow[];
    combined?: { names: string[]; run: RunResult; gain: number };
}

export interface ProfileHost extends Host {
    /** Switches exactly these experiments on (everything else off). Does not persist. */
    apply(features: ReadonlySet<string>, anims: ReadonlySet<string>): void;
    progress(done: number, total: number, label: string): void;
    cancelled(): boolean;
    /** Called after every run so the UI can show partial results. */
    update(r: ProfileResult): void;
}

export interface ProfileOptions {
    scenario: ScenarioKind;
    ms: number;
    stress: number;
    items: ProfileItem[];
    /** Run every experiment even when the quick checks say there is nothing to win. */
    force: boolean;
}

/** Below this the scenario is already smooth: there is nothing to measure. */
export const SMOOTH_LOST = 2;
/** A baseline is re-measured after this many experiments, so slow drift (heat, background work) cancels out. */
export const BRACKET = 6;
export const score = (r: RunResult): number => r.frames.lostPerSec;

const NONE: ReadonlySet<string> = new Set();
const pick = (items: ProfileItem[]) => ({
    features: new Set(items.filter(i => i.kind === "feature").map(i => i.id)),
    anims: new Set(items.filter(i => i.kind === "anim").map(i => i.id))
});

export async function runProfile(host: ProfileHost, o: ProfileOptions): Promise<ProfileResult> {
    const m = host.monitor;
    const res: ProfileResult = { status: "running", scenario: o.scenario, ms: o.ms, stress: o.stress, budget: m.budget, base: undefined as unknown as RunResult, bases: [], ref: 0, threshold: 0, rows: [] };
    const total = o.items.length + Math.ceil(o.items.length / BRACKET) + 4;
    let step = 0;
    const run = async (label: string, features: ReadonlySet<string>, anims: ReadonlySet<string>): Promise<RunResult> => {
        host.progress(step++, total, label);
        host.apply(features, anims);
        await frames(2);
        const r = await runScenario(host, o.scenario, o.ms, o.stress);
        host.update(res);
        return r;
    };
    const baseline = async (label: string): Promise<void> => {
        res.bases.push(await run(label, NONE, NONE));
        res.baseEnd = res.bases[res.bases.length - 1];
    };
    host.ui(true);
    m.lockBudget();
    try {
        await run("warming up", NONE, NONE);
        await baseline("baseline");
        res.base = res.bases[0];
        res.budget = m.budget;
        res.ref = score(res.base);
        res.threshold = Math.max(3, res.ref * 0.15);
        if (res.ref < SMOOTH_LOST && !o.force) {
            res.status = "smooth";
            return res;
        }
        const all = pick(o.items);
        const ceil = await run("everything off", all.features, all.anims);
        res.ceiling = { run: ceil, gain: res.ref - score(ceil) };
        if (res.ceiling.gain < res.threshold && !o.force) {
            res.status = "no-css-gain";
            return res;
        }
        let since = 0;
        for (const item of o.items) {
            if (host.cancelled()) {
                res.status = "cancelled";
                return res;
            }
            const p = pick([item]);
            const r = await run(item.name, p.features, p.anims);
            res.rows.push({ ...item, run: r, gain: res.ref - score(r), slot: res.bases.length - 1, significant: false });
            res.rows.sort((a, b) => b.gain - a.gain);
            if (++since === BRACKET) {
                since = 0;
                await baseline("baseline check");
            }
        }
        if (since > 0 || res.bases.length < 2) {
            await baseline("baseline again");
        }
        const scores = res.bases.map(score);
        res.ref = scores.reduce((x, y) => x + y, 0) / scores.length;
        let drift = 0;
        for (let i = 1; i < scores.length; i++) {
            drift = Math.max(drift, Math.abs(scores[i] - scores[i - 1]));
        }
        res.threshold = Math.max(3, res.ref * 0.15);
        res.drift = drift;
        for (const row of res.rows) {
            const before = scores[row.slot];
            const after = scores[Math.min(row.slot + 1, scores.length - 1)];
            row.gain = (before + after) / 2 - score(row.run);
            /* judged against the drift between ITS two neighbouring baselines */
            row.significant = row.gain > Math.max(res.threshold, Math.abs(before - after) * 1.5);
        }
        res.rows.sort((a, b) => b.gain - a.gain);
        const top = res.rows.filter(r => r.significant).slice(0, 4);
        if (top.length > 1) {
            const p = pick(top);
            const r = await run("top culprits together", p.features, p.anims);
            res.combined = { names: top.map(t => t.name), run: r, gain: res.ref - score(r) };
        }
        res.status = "done";
        return res;
    }
    finally {
        if (res.status === "running") {
            res.status = "cancelled";
        }
        m.unlockBudget();
        host.ui(false);
        host.update(res);
    }
}
