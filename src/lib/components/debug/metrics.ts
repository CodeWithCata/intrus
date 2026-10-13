/**
 * The live monitor of the performance debugger. It watches, with as little overhead as possible:
 *  - frame times (requestAnimationFrame deltas, works in every browser incl. iOS Safari),
 *  - timer lag (a 50 ms timer: if it is late the main thread was busy; if frames are late but timers
 *    are not, the cost is in painting / compositing: that tells JS-bound from render-bound),
 *  - long tasks, long animation frames (with script attribution), slow taps and layout shifts,
 *    where the browser offers them (Chrome / Android; iOS Safari has none of these).
 * It knows nothing about the app: the caller passes a function that names the current screen.
 */
import { LATE_FACTOR, describeNode, fmt, shortUrl, snapBudget, summarizeFrames, type FrameSummary, type PerfEvent, type PerfEventKind } from "./stats.ts";

const RING = 240;
const PROBE_MS = 50;
const MAX_EVENTS = 150;
const DISCARD = 4;
const TAP_NAMES = new Set(["pointerdown", "pointerup", "click", "keydown", "keyup"]);

/* Browser APIs that lib.dom does not type yet. */
interface LoafScript {
    duration: number;
    invoker?: string;
    sourceURL?: string;
    sourceFunctionName?: string;
    forcedStyleAndLayoutDuration?: number;
}
interface LoafEntry extends PerformanceEntry {
    blockingDuration: number;
    renderStart: number;
    styleAndLayoutStart: number;
    scripts: LoafScript[];
}
interface EventTimingEntry extends PerformanceEntry {
    processingStart: number;
    processingEnd: number;
    target: Node | null;
    interactionId?: number;
}
interface ShiftEntry extends PerformanceEntry {
    value: number;
    hadRecentInput: boolean;
    sources?: { node: Node | null }[];
}
interface LcpEntry extends PerformanceEntry {
    element: Element | null;
}
interface MemoryInfo {
    usedJSHeapSize: number;
}

export interface CtxStat {
    key: string;
    frames: number;
    ms: number;
    late: number;
    lost: number;
    worst: number;
}

export interface TapStat {
    key: string;
    n: number;
    worst: number;
    input: number;
    proc: number;
    present: number;
}

/** What one measured window produced. */
export interface RunResult {
    frames: FrameSummary;
    longMs: number;
    longCount: number;
    lagMax: number;
    lagCount: number;
    budget: number;
    stress: number;
    note?: string;
}

export class Recorder {
    deltas: number[] = [];
    longMs = 0;
    longCount = 0;
    lagMax = 0;
    lagCount = 0;
}

export class Monitor {
    budget = 1000 / 60;
    /** Busy-wait (ms) added to every frame to simulate a slower phone. Only set while a test runs. */
    stress = 0;
    events: PerfEvent[] = [];
    readonly byCtx = new Map<string, CtxStat>();
    readonly taps = new Map<string, TapStat>();
    readonly support = { longtask: false, loaf: false, event: false, shift: false, heap: false };
    cls = 0;
    fcp = 0;
    lcp = 0;
    lcpEl = "";
    dom = 0;
    anims = 0;
    heapMb = 0;
    heapStartMb = 0;
    heapStartAt = 0;
    running = false;
    /** Return true to leave a slow tap out of the log (the debugger's own buttons). */
    ignoreTap: (startTime: number) => boolean = () => false;

    private ring = new Float32Array(RING);
    private n = 0;
    private head = 0;
    private frameNo = 0;
    private last = 0;
    private skip = true;
    private skipProbe = true;
    private locked = false;
    private raf = 0;
    private probeTimer = 0;
    private probeAt = 0;
    private sampleTimer = 0;
    private tick = 0;
    private lastLongAt = 0;
    private obs: PerformanceObserver[] = [];
    private recorders = new Set<Recorder>();
    private ctx: () => string;
    private changed: () => void;

    constructor(ctx: () => string, changed: () => void = () => {}) {
        this.ctx = ctx;
        this.changed = changed;
    }

    start(): void {
        if (this.running) {
            return;
        }
        this.running = true;
        this.last = 0;
        this.skip = true;
        this.skipProbe = true;
        this.probeAt = performance.now();
        this.raf = requestAnimationFrame(this.frame);
        this.probeTimer = window.setTimeout(this.probe, PROBE_MS);
        this.sampleTimer = window.setInterval(this.sample, 1000);
        document.addEventListener("visibilitychange", this.onVisibility);
        this.observeAll();
        this.sample();
    }

    stop(): void {
        this.running = false;
        cancelAnimationFrame(this.raf);
        clearTimeout(this.probeTimer);
        clearInterval(this.sampleTimer);
        document.removeEventListener("visibilitychange", this.onVisibility);
        this.obs.forEach(o => o.disconnect());
        this.obs = [];
    }

    /** Fixes the frame budget (needed while stress changes frame times). */
    lockBudget(): void {
        this.locked = true;
    }

    unlockBudget(): void {
        this.locked = false;
    }

    /** The last `max` frame deltas, oldest first. */
    recent(max = RING): number[] {
        const c = Math.min(max, this.n);
        const out = new Array<number>(c);
        for (let i = 0; i < c; i++) {
            out[i] = this.ring[(this.head - c + i + RING) % RING];
        }
        return out;
    }

    summary(frames = RING): FrameSummary {
        return summarizeFrames(this.recent(frames), this.budget);
    }

    /** Events of the last `ms` milliseconds. */
    eventsSince(ms: number): PerfEvent[] {
        const now = performance.now();
        return this.events.filter(e => now - e.t < ms);
    }

    record(): Recorder {
        const r = new Recorder();
        this.recorders.add(r);
        return r;
    }

    finish(r: Recorder): RunResult {
        this.recorders.delete(r);
        return {
            frames: summarizeFrames(r.deltas.slice(DISCARD), this.budget),
            longMs: r.longMs,
            longCount: r.longCount,
            lagMax: r.lagMax,
            lagCount: r.lagCount,
            budget: this.budget,
            stress: this.stress
        };
    }

    mark(label: string): void {
        this.add("mark", 0, label);
    }

    clearEvents(): void {
        this.events = [];
        this.taps.clear();
        this.byCtx.clear();
        this.cls = 0;
        this.changed();
    }

    /** The slowest tap seen so far. */
    worstTap(): TapStat | null {
        let w: TapStat | null = null;
        for (const t of this.taps.values()) {
            if (!w || t.worst > w.worst) {
                w = t;
            }
        }
        return w;
    }

    /* ---------- internals ---------- */

    private add(kind: PerfEventKind, dur: number, label: string, detail?: string, t = performance.now()): void {
        this.events.push({ t, kind, dur, label, detail, ctx: this.ctx() });
        if (this.events.length > MAX_EVENTS) {
            this.events.splice(0, this.events.length - MAX_EVENTS);
        }
        this.changed();
    }

    /** A frame gap is logged at once; the richer long-task / LoAF entry arrives later and replaces it. */
    private dropStall(endAt: number): void {
        for (let i = this.events.length - 1; i >= 0; i--) {
            const e = this.events[i];
            if (e.kind === "stall" && Math.abs(e.t - endAt) < 250) {
                this.events.splice(i, 1);
            }
        }
    }

    private onVisibility = (): void => {
        this.skip = true;
        this.skipProbe = true;
        this.last = 0;
    };

    private frame = (t: number): void => {
        if (!this.running) {
            return;
        }
        const prev = this.last;
        this.last = t;
        if (this.stress > 0) {
            const end = performance.now() + this.stress;
            while (performance.now() < end) {
                /* stress: burn main-thread time to expose small costs on a fast device */
            }
        }
        if (prev && !this.skip && !document.hidden) {
            this.push(t - prev, t);
        }
        this.skip = false;
        this.raf = requestAnimationFrame(this.frame);
    };

    private push(d: number, t: number): void {
        this.ring[this.head] = d;
        this.head = (this.head + 1) % RING;
        this.n = Math.min(this.n + 1, RING);
        for (const r of this.recorders) {
            r.deltas.push(d);
        }
        if (!this.locked && ++this.frameNo % 30 === 0 && this.n >= 60) {
            const sorted = this.recent().sort((a, b) => a - b);
            this.budget = snapBudget(sorted[Math.floor(sorted.length * 0.25)]);
        }
        if (this.stress === 0) {
            const key = this.ctx();
            let s = this.byCtx.get(key);
            if (!s) {
                s = { key, frames: 0, ms: 0, late: 0, lost: 0, worst: 0 };
                this.byCtx.set(key, s);
            }
            s.frames++;
            s.ms += d;
            if (d > this.budget * LATE_FACTOR) {
                s.late++;
                s.lost += d - this.budget;
            }
            if (d > s.worst) {
                s.worst = d;
            }
        }
        if (d > 100 && t - this.lastLongAt > 250) {
            this.add("stall", d, `no frame for ${fmt(d, 0)} ms`, undefined, t);
        }
    }

    private probe = (): void => {
        const now = performance.now();
        if (!document.hidden && !this.skipProbe) {
            const drift = now - this.probeAt - PROBE_MS;
            if (drift > 40) {
                for (const r of this.recorders) {
                    r.lagCount++;
                    r.lagMax = Math.max(r.lagMax, drift);
                }
                if (drift > 80) {
                    this.add("lag", drift, `timers ${fmt(drift, 0)} ms late: main thread busy`);
                }
            }
        }
        this.skipProbe = false;
        this.probeAt = now;
        this.probeTimer = window.setTimeout(this.probe, PROBE_MS);
    };

    private sample = (): void => {
        if (document.hidden) {
            return;
        }
        try {
            this.anims = document.getAnimations().length;
        }
        catch {
            this.anims = 0;
        }
        if ((this.tick++ & 1) === 0) {
            this.dom = document.getElementsByTagName("*").length;
        }
        const mem = (performance as Performance & { memory?: MemoryInfo }).memory;
        if (mem) {
            this.support.heap = true;
            this.heapMb = mem.usedJSHeapSize / 1048576;
            if (!this.heapStartMb) {
                this.heapStartMb = this.heapMb;
                this.heapStartAt = performance.now();
            }
        }
    };

    private watch(type: string, init: object, cb: (entries: PerformanceEntry[]) => void): boolean {
        const types: readonly string[] = PerformanceObserver.supportedEntryTypes ?? [];
        if (!types.includes(type)) {
            return false;
        }
        try {
            const po = new PerformanceObserver(list => cb(list.getEntries()));
            po.observe({ type, ...init } as PerformanceObserverInit);
            this.obs.push(po);
            return true;
        }
        catch {
            return false;
        }
    }

    private observeAll(): void {
        this.support.loaf = this.watch("long-animation-frame", {}, es => es.forEach(e => this.onLoaf(e as LoafEntry)));
        this.support.longtask = this.watch("longtask", {}, es => es.forEach(e => this.onLong(e)));
        this.support.event = this.watch("event", { durationThreshold: 40 }, es => es.forEach(e => this.onTap(e as EventTimingEntry)));
        this.support.shift = this.watch("layout-shift", {}, es => es.forEach(e => this.onShift(e as ShiftEntry)));
        this.watch("paint", { buffered: true }, es => {
            for (const e of es) {
                if (e.name === "first-contentful-paint") {
                    this.fcp = e.startTime;
                }
            }
        });
        this.watch("largest-contentful-paint", { buffered: true }, es => {
            const e = es[es.length - 1] as LcpEntry | undefined;
            if (e) {
                this.lcp = e.startTime;
                this.lcpEl = describeNode(e.element);
            }
        });
    }

    private onLong(e: PerformanceEntry): void {
        const end = e.startTime + e.duration;
        this.dropStall(end);
        this.lastLongAt = end;
        for (const r of this.recorders) {
            r.longMs += e.duration;
            r.longCount++;
        }
        if (!this.support.loaf) {
            this.add("longtask", e.duration, "main thread blocked", undefined, end);
        }
    }

    private onLoaf(e: LoafEntry): void {
        const end = e.startTime + e.duration;
        this.dropStall(end);
        this.lastLongAt = end;
        const scripts = [...(e.scripts ?? [])].sort((a, b) => b.duration - a.duration);
        const scriptMs = scripts.reduce((s, x) => s + x.duration, 0);
        const renderMs = e.renderStart > 0 ? Math.max(0, end - e.renderStart) : 0;
        const layoutMs = e.styleAndLayoutStart > 0 ? Math.max(0, end - e.styleAndLayoutStart) : 0;
        const name = (s: LoafScript) => s.invoker || s.sourceFunctionName || shortUrl(s.sourceURL) || "anonymous";
        const label = scripts.length ? `${name(scripts[0])} ${fmt(scripts[0].duration, 0)} ms` : "rendering only, no script";
        const bits = [`scripts ${fmt(scriptMs, 0)} ms`, `render ${fmt(renderMs, 0)} ms`, `style+layout ${fmt(layoutMs, 0)} ms`];
        const forced = scripts.reduce((s, x) => s + (x.forcedStyleAndLayoutDuration ?? 0), 0);
        if (forced > 10) {
            bits.push(`forced layout ${fmt(forced, 0)} ms`);
        }
        if (scripts[1]) {
            bits.push(`then ${name(scripts[1])} ${fmt(scripts[1].duration, 0)} ms`);
        }
        this.add("loaf", e.duration, label, bits.join(", "), end);
    }

    private onTap(e: EventTimingEntry): void {
        if (e.duration < 40 || !((e.interactionId ?? 0) > 0 || TAP_NAMES.has(e.name)) || this.ignoreTap(e.startTime)) {
            return;
        }
        const input = Math.max(0, e.processingStart - e.startTime);
        const proc = Math.max(0, e.processingEnd - e.processingStart);
        const present = Math.max(0, e.startTime + e.duration - e.processingEnd);
        const key = `${e.name} on ${describeNode(e.target)}`;
        const old = this.taps.get(key);
        if (!old || e.duration >= old.worst) {
            this.taps.set(key, { key, n: (old?.n ?? 0) + 1, worst: e.duration, input, proc, present });
        }
        else {
            old.n++;
        }
        if (this.taps.size > 30) {
            const first = this.taps.keys().next().value;
            if (first !== undefined) {
                this.taps.delete(first);
            }
        }
        if (e.duration >= 100) {
            this.add("tap", e.duration, key, `waited ${fmt(input, 0)} ms, handler ${fmt(proc, 0)} ms, paint ${fmt(present, 0)} ms`, e.startTime + e.duration);
        }
    }

    private onShift(e: ShiftEntry): void {
        if (e.hadRecentInput) {
            return;
        }
        this.cls += e.value;
        if (e.value >= 0.02) {
            this.add("shift", 0, `layout shift ${fmt(e.value, 3)}`, describeNode(e.sources?.[0]?.node), e.startTime);
        }
    }
}
