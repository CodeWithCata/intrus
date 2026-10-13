/**
 * The text report ("Copy report" / "Share"): everything the debugger knows, in a form that can be pasted
 * into a chat or an issue from a phone.
 */
import type { Monitor } from "./metrics.ts";
import type { ProfileResult } from "./scenarios.ts";
import { ago, fmt, type AnimInfo, type AuditResult, type Finding, type FrameSummary } from "./stats.ts";

export interface Env {
    ua: string;
    viewport: string;
    dpr: number;
    cores: number | null;
    memoryGb: number | null;
    network: string;
    saveData: boolean;
    reducedMotion: boolean;
    standalone: boolean;
    touch: boolean;
    lite: boolean;
    battery: string;
}

interface Battery {
    level: number;
    charging: boolean;
}
interface NavExtra {
    deviceMemory?: number;
    connection?: { effectiveType?: string; saveData?: boolean; downlink?: number };
    getBattery?: () => Promise<Battery>;
}

export async function collectEnv(lite: boolean): Promise<Env> {
    const nav = navigator as Navigator & NavExtra;
    let battery = "n/a";
    try {
        const b = nav.getBattery ? await Promise.race([nav.getBattery(), new Promise<null>(r => setTimeout(() => r(null), 400))]) : null;
        if (b) {
            battery = `${Math.round(b.level * 100)}%${b.charging ? " charging" : ""}`;
        }
    }
    catch {
        /* no battery API */
    }
    const c = nav.connection;
    return {
        ua: navigator.userAgent,
        viewport: `${innerWidth}x${innerHeight}`,
        dpr: devicePixelRatio || 1,
        cores: navigator.hardwareConcurrency ?? null,
        memoryGb: nav.deviceMemory ?? null,
        network: c ? `${c.effectiveType ?? "?"}${c.downlink ? " " + c.downlink + " Mbps" : ""}` : "n/a",
        saveData: !!c?.saveData,
        reducedMotion: matchMedia("(prefers-reduced-motion:reduce)").matches,
        standalone: matchMedia("(display-mode: standalone)").matches,
        touch: matchMedia("(hover:none),(pointer:coarse)").matches,
        lite,
        battery
    };
}

export interface ReportInput {
    env: Env;
    monitor: Monitor;
    summary: FrameSummary;
    findings: Finding[];
    profile: ProfileResult | null;
    anims: AnimInfo[] | null;
    audit: AuditResult | null;
    featuresOff: string[];
    animsOff: string[];
    screen: string;
    /** Text of the flash recorder (empty when nothing was recorded). */
    flash?: string;
}

export function buildReport(i: ReportInput): string {
    const m = i.monitor;
    const s = i.summary;
    const now = performance.now();
    const L: string[] = [];
    L.push(`INTRUS PERFORMANCE REPORT ${new Date().toISOString()}`);
    L.push("");
    L.push("## Device");
    L.push(`${i.env.ua}`);
    L.push(`viewport ${i.env.viewport} @${i.env.dpr}x, cores ${i.env.cores ?? "?"}, memory ${i.env.memoryGb ?? "?"} GB, network ${i.env.network}${i.env.saveData ? " (save-data)" : ""}, battery ${i.env.battery}`);
    L.push(`touch ${i.env.touch}, lite mode ${i.env.lite}, reduced motion ${i.env.reducedMotion}, installed ${i.env.standalone}`);
    L.push(`refresh ~${Math.round(1000 / m.budget)} Hz (budget ${fmt(m.budget)} ms). Browser reports: long tasks ${m.support.longtask}, long animation frames ${m.support.loaf}, slow taps ${m.support.event}, layout shift ${m.support.shift}, heap ${m.support.heap}`);
    L.push(`screen now: ${i.screen}. First paint ${fmt(m.fcp, 0)} ms, largest paint ${fmt(m.lcp, 0)} ms${m.lcpEl ? " (" + m.lcpEl + ")" : ""}, DOM ${m.dom} nodes, ${m.anims} animations, heap ${m.support.heap ? fmt(m.heapMb, 0) + " MB" : "n/a"}, CLS ${fmt(m.cls, 3)}`);
    L.push("");
    L.push("## Live (last ~4 s)");
    L.push(`${fmt(s.fps, 0)} fps, avg ${fmt(s.avg)} ms, p95 ${fmt(s.p95)} ms, p99 ${fmt(s.p99)} ms, worst ${fmt(s.worst, 0)} ms, ${s.late}/${s.frames} late frames, ${fmt(s.lostPerSec, 0)} ms lost per second`);
    L.push("");
    L.push("## Findings");
    for (const f of i.findings) {
        L.push(`- [${f.level}] ${f.title}${f.detail ? ": " + f.detail : ""}`);
    }
    const ctx = [...m.byCtx.values()].filter(c => c.frames >= 30).sort((a, b) => b.lost / b.ms - a.lost / a.ms);
    if (ctx.length) {
        L.push("");
        L.push("## By screen (since opened)");
        for (const c of ctx) {
            L.push(`- ${c.key}: ${c.frames} frames, ${fmt((c.late / c.frames) * 100, 0)}% late, worst ${fmt(c.worst, 0)} ms, ${fmt((c.lost / c.ms) * 1000, 0)} ms lost/s`);
        }
    }
    const p = i.profile;
    if (p) {
        L.push("");
        L.push(`## Auto-profile (${p.scenario}, ${p.ms} ms runs, stress ${p.stress} ms, ${p.status})`);
        L.push(`baseline ${fmt(p.ref)} ms lost/s (${fmt(p.base?.frames.fps ?? 0, 0)} fps), noise threshold ${fmt(p.threshold)}, drift ${fmt(p.drift ?? 0)}`);
        if (p.ceiling) {
            L.push(`everything off: ${fmt(p.ceiling.run.frames.lostPerSec)} ms lost/s (gain ${fmt(p.ceiling.gain)})`);
        }
        for (const r of p.rows.slice(0, 12)) {
            L.push(`- ${r.significant ? "*" : " "} ${r.name}: gain ${fmt(r.gain)} ms/s (${fmt(r.run.frames.fps, 0)} fps)`);
        }
        if (p.combined) {
            L.push(`top culprits together (${p.combined.names.join(", ")}): gain ${fmt(p.combined.gain)} ms/s`);
        }
    }
    if (i.anims) {
        L.push("");
        L.push("## Animations");
        for (const a of i.anims.slice(0, 15)) {
            L.push(`- ${a.type} ${a.name} x${a.count} (${a.running} running${a.offscreen ? ", " + a.offscreen + " off-screen" : ""}${a.infinite ? ", infinite" : ""}) animates ${a.props.join(", ") || "?"} => ${a.cost}`);
        }
    }
    const a = i.audit;
    if (a) {
        L.push("");
        L.push("## Audit");
        L.push(`DOM ${a.dom} (depth ${a.depth}), svg nodes ${a.svgNodes}, SMIL ${a.smil}, svg filters ${a.svgFilters}, style+layout pass ${fmt(a.styleMs)} ms, images ${fmt(a.imageMb, 1)} MB`);
        L.push(`backdrop ${a.counts.backdrop}, blur ${a.counts.blur}, blend ${a.counts.blend}, mask ${a.counts.mask}, big shadows ${a.counts.shadow}, will-change ${a.counts.willChange}, backface ${a.counts.backface}, fixed ${a.counts.fixed}`);
        for (const x of a.suspects) {
            L.push(`- ${x.sel} x${x.n}: ${x.why}`);
        }
    }
    const taps = [...m.taps.values()].sort((x, y) => y.worst - x.worst).slice(0, 5);
    if (taps.length) {
        L.push("");
        L.push("## Slow taps");
        for (const t of taps) {
            L.push(`- ${t.key}: ${fmt(t.worst, 0)} ms (waited ${fmt(t.input, 0)}, handler ${fmt(t.proc, 0)}, paint ${fmt(t.present, 0)}) x${t.n}`);
        }
    }
    L.push("");
    L.push("## Recent events");
    const ev = m.events.slice(-25).reverse();
    if (!ev.length) {
        L.push("none");
    }
    for (const e of ev) {
        L.push(`- ${ago(now - e.t)} [${e.ctx}] ${e.kind} ${e.dur ? fmt(e.dur, 0) + " ms " : ""}${e.label}${e.detail ? " | " + e.detail : ""}`);
    }
    L.push("");
    if (i.flash) {
        L.push("");
        L.push("## Flash recorder");
        L.push(i.flash);
    }
    L.push("");
    L.push(`Switched off by hand: features ${i.featuresOff.join(", ") || "none"}; animations ${i.animsOff.join(", ") || "none"}`);
    return L.join("\n");
}
