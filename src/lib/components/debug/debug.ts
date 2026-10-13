/**
 * Performance debugger (the bug pill). Loaded on demand by boot() only with ?debug=1, never for players.
 *
 * Tabs:
 *  Live    fps / frame-time graph, long tasks, timer lag, plain-language verdict, cost per screen
 *  Find    auto-profile: measures every effect and animation and ranks them by what they win back
 *          (plus the old guided "does it still flash?" hunt for glitches that fps cannot show)
 *  Anim    what animates right now, which properties, and what each one costs
 *  Audit   expensive CSS / SVG / images / DOM size on the page
 *  Log     long tasks and long animation frames (with the script behind them), slow taps, layout shifts
 *  Switch  manual on/off switches for every experiment
 *
 * The pill shows live fps and can be dragged; a long press drops a mark into the log. Everything is
 * built with createElement and textContent (never from HTML strings) and only measures while this module is loaded.
 */
import { closeSheet, openSheet } from "#lib/components/ui/sheets.ts";
import { nav } from "#lib/stores/nav.svelte.ts";
import { state } from "#lib/stores/settings.svelte.ts";
import { AnimKiller, FEATURES, REDUCERS, applicable, buildFeatureCss, featureGroups, usedFeatures } from "./features.ts";
import { FlashRecorder } from "./flash.ts";
import { auditPage, inspectAnimations } from "./inspect.ts";
import { Monitor } from "./metrics.ts";
import { buildReport, collectEnv, type Env } from "./report.ts";
import { runProfile, runScenario, scanAnimations, score, type Host, type ProfileHost, type ProfileItem, type ProfileResult, type ScenarioKind, type SeenAnim } from "./scenarios.ts";
import { DEBUG_CSS } from "./styles.ts";
import { ago, diagnose, fmt, healthOf, type AnimInfo, type AuditResult, type Finding, type FrameSummary, type Health } from "./stats.ts";

type Kid = Node | string | null | false | undefined;
type TabId = "live" | "find" | "flash" | "anim" | "audit" | "log" | "sw";

const TABS: readonly [TabId, string][] = [
    ["live", "Live"],
    ["find", "Find"],
    ["flash", "Flash"],
    ["anim", "Animations"],
    ["audit", "Audit"],
    ["log", "Log"],
    ["sw", "Switches"]
];
const K_ON = "intrus.dbg";
const K_POS = "intrus.dbgpos";
const K_TAB = "intrus.dbgtab";
const STRESS: readonly [number, string][] = [
    [0, "Off"],
    [6, "Medium (+6 ms)"],
    [12, "Heavy (+12 ms)"]
];
const SCENARIOS: readonly [ScenarioKind, string][] = [
    ["sheet", "Open settings"],
    ["idle", "Idle"],
    ["scroll", "Scroll"]
];

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, ...kids: Kid[]): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (cls) {
        el.className = cls;
    }
    for (const k of kids) {
        if (k !== null && k !== false && k !== undefined) {
            el.append(k);
        }
    }
    return el;
}

function btn(label: string, onClick: () => void, cls = ""): HTMLButtonElement {
    const b = h("button", "dbgb " + cls, label);
    b.type = "button";
    b.onclick = onClick;
    return b;
}

function readJson<T>(key: string, fallback: T): T {
    try {
        const v = localStorage.getItem(key);
        return v ? (JSON.parse(v) as T) : fallback;
    }
    catch {
        return fallback;
    }
}
function writeJson(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        /* private mode */
    }
}

async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch {
        /* not a secure context, or no permission: fall back */
    }
    try {
        const ta = h("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.append(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
    }
    catch {
        return false;
    }
}

function drawSpark(cv: HTMLCanvasElement, data: number[], budget: number): void {
    const w = cv.clientWidth;
    const ht = cv.clientHeight;
    if (!w || !ht) {
        return;
    }
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(ht * dpr);
    }
    const g = cv.getContext("2d");
    if (!g) {
        return;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, ht);
    const top = budget * 4;
    const bw = w / 120;
    data.slice(-120).forEach((d, i) => {
        const bh = Math.max(1, (Math.min(d, top) / top) * ht);
        g.fillStyle = d <= budget * 1.25 ? "#2fbf5f" : d <= budget * 1.5 ? "#f0a400" : "#ff3b5c";
        g.fillRect(i * bw, ht - bh, Math.max(1, bw - 0.5), bh);
    });
    const y = ht - (budget / top) * ht;
    g.strokeStyle = "rgba(0,0,0,.45)";
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
}

export function initDebug(): void {
    if (document.querySelector(".dbgroot")) {
        return;
    }
    const R = document.documentElement;

    /* ---------- state ---------- */
    const ctxLabel = () => `${nav.screen ?? "?"}${state.sheet ? "+" + state.sheet : ""}`;
    const monitor = new Monitor(ctxLabel, () => {
        evDirty = true;
    });
    const killer = new AnimKiller();
    const flash = new FlashRecorder();
    let evDirty = true;
    let on = new Set<string>(readJson<string[]>(K_ON, []));
    let animsOff = new Set<string>();
    let tab: TabId = (readJson<string>(K_TAB, "live") as TabId) || "live";
    if (!TABS.some(t => t[0] === tab)) {
        tab = "live";
    }
    let open = false;
    let busy = false;
    let cancel = false;
    let scenario: ScenarioKind = "sheet";
    let stress = 0;
    let profile: ProfileResult | null = null;
    let audit: AuditResult | null = null;
    let anims: AnimInfo[] | null = null;
    let seen = new Map<string, SeenAnim>();
    let env: Env | null = null;
    let reportText = "";
    const ran = new Set<string>();

    /* ---------- DOM skeleton ---------- */
    const style = h("style");
    style.id = "dbg-css";
    style.textContent = DEBUG_CSS;
    const featStyle = h("style");
    featStyle.id = "dbg-features";
    featStyle.textContent = buildFeatureCss();
    document.head.append(style, featStyle);

    const root = h("div", "dbgroot");
    const fabNum = h("b", null, "-");
    const fab = h("div", "dbgf ok", "\u{1F41E}", fabNum);
    fab.setAttribute("role", "button");
    fab.tabIndex = 0;
    fab.setAttribute("aria-label", "Open performance debugger (long press adds a mark)");
    const panel = h("div", "dbgp");
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Performance debugger");
    const runBar = h("button", "dbgrun");
    runBar.type = "button";
    runBar.hidden = true;
    root.append(fab, panel, runBar);
    document.body.append(root);

    const title = h("small", null, "");
    const head = h("div", "dbgh", h("h3", null, "Perf debugger ", title), btn("Close", () => setOpen(false), "alt sm"));
    const tabsEl = h("div", "dbgtabs");
    tabsEl.setAttribute("role", "tablist");
    const note = h("p", "dbgnote");
    note.setAttribute("role", "status");
    const ask = h("div", "dbgq");
    ask.hidden = true;
    const body = h("div", "dbgbody");
    const foot = h("div", "dbgfoot");
    panel.append(head, tabsEl, note, ask, body, foot);

    const say = (t: string) => {
        note.textContent = t;
    };

    /* ---------- applying experiments ---------- */
    function paint(features: ReadonlySet<string>, off: ReadonlySet<string>): void {
        for (const f of FEATURES) {
            const v = features.has(f.id);
            R.classList.toggle("dbg-" + f.id, v);
            if (f.run && v !== ran.has(f.id)) {
                f.run(v);
                if (v) {
                    ran.add(f.id);
                }
                else {
                    ran.delete(f.id);
                }
            }
        }
        killer.set(off);
    }
    const sync = () => {
        paint(on, animsOff);
        writeJson(K_ON, [...on]);
    };
    const toggleFeature = (id: string, v: boolean) => {
        if (v) {
            on.add(id);
        }
        else {
            on.delete(id);
        }
        sync();
    };
    const toggleAnim = (name: string, v: boolean) => {
        if (v) {
            animsOff.add(name);
        }
        else {
            animsOff.delete(name);
        }
        sync();
    };

    /* ---------- host for scenarios ---------- */
    const host: ProfileHost = {
        monitor,
        openSheet: () => openSheet("set"),
        closeSheet,
        sheetOpen: () => !!state.sheet,
        ui(hidden) {
            root.classList.toggle("dbgquiet", hidden);
            runBar.hidden = !hidden;
        },
        apply: (f, a) => paint(f, a),
        progress(i, n, label) {
            runBar.textContent = `${i + 1}/${n}: ${label} (tap to stop)`;
        },
        cancelled: () => cancel,
        update(r) {
            profile = r;
            if (!busy || tab === "find") {
                scheduleRender();
            }
        }
    };
    runBar.onclick = () => {
        cancel = true;
        runBar.textContent = "Stopping...";
    };
    const plain: Host = host;

    const guard = async (work: () => Promise<void>): Promise<void> => {
        if (busy) {
            return;
        }
        busy = true;
        cancel = false;
        try {
            await work();
        }
        finally {
            busy = false;
            paint(on, animsOff);
            host.ui(false);
            ask.hidden = true;
            scheduleRender();
        }
    };

    function summaryLine(r: { frames: FrameSummary; longCount: number; lagCount: number }): string {
        const f = r.frames;
        return `${fmt(f.fps, 0)} fps, p95 ${fmt(f.p95)} ms, ${fmt(f.lateRatio * 100, 0)}% late, ${fmt(f.lostPerSec, 0)} ms lost/s${r.longCount ? `, ${r.longCount} long tasks` : ""}${r.lagCount ? `, ${r.lagCount} timer delays` : ""}`;
    }

    const msFor = (k: ScenarioKind) => (k === "scroll" ? 2400 : 1600);

    async function testOnce(): Promise<void> {
        await guard(async () => {
            host.ui(true);
            runBar.textContent = "Measuring...";
            const r = await runScenario(plain, scenario, msFor(scenario), stress);
            host.ui(false);
            say(`Test (${scenario}${stress ? ", stress " + stress + " ms" : ""}): ${summaryLine(r)}${r.note ? " [" + r.note + "]" : ""}`);
        });
    }

    async function ensureScan(): Promise<void> {
        if (seen.size) {
            return;
        }
        host.ui(true);
        runBar.textContent = "Looking for animations...";
        monitor.lockBudget();
        try {
            seen = (await scanAnimations(plain, scenario, msFor(scenario))).seen;
        }
        finally {
            monitor.unlockBudget();
        }
    }

    const animNames = (): string[] => {
        const names = new Set(seen.keys());
        for (const a of inspectAnimations()) {
            if (a.killable) {
                names.add(a.name);
            }
        }
        return [...names].sort();
    };

    async function autoProfile(force: boolean): Promise<void> {
        await guard(async () => {
            profile = null;
            say("Measuring. Do not touch the screen; the page is quiet on purpose.");
            await ensureScan();
            const used = usedFeatures();
            const items: ProfileItem[] = [
                ...REDUCERS.filter(f => f.id !== "allAnim" && applicable(f, used)).map(f => ({ kind: "feature" as const, id: f.id, name: f.name })),
                ...animNames().map(n => ({ kind: "anim" as const, id: n, name: "@keyframes " + n }))
            ];
            profile = await runProfile(host, { scenario, ms: msFor(scenario), stress, items, force });
            say(profile.status === "done" ? "Done. The ranked list shows what each switch wins back." : "");
        });
    }

    /* ---------- guided hunt (human in the loop: for flashes fps cannot see) ---------- */
    function question(text: string, options: string[]): Promise<string> {
        ask.replaceChildren(h("p", null, text));
        const row = h("div", "dbgrow");
        return new Promise(resolve => {
            for (const o of options) {
                row.append(
                    btn(o, () => {
                        ask.hidden = true;
                        resolve(o);
                    }, o === "Stop" ? "alt" : "")
                );
            }
            ask.append(row);
            ask.hidden = false;
        });
    }

    async function hunt(getIds: () => Promise<string[]>, apply: (s: ReadonlySet<string>) => void, label: (id: string) => string): Promise<void> {
        await guard(async () => {
            const ids = await getIds();
            if (!ids.length) {
                say("Nothing to test: no CSS animations found.");
                return;
            }
            const watch = async (set: Set<string>, what: string) => {
                apply(set);
                host.ui(true);
                runBar.textContent = `Watch the screen: ${what}`;
                await runScenario(plain, scenario, msFor(scenario));
                host.ui(false);
            };
            let pool = ids;
            await watch(new Set(pool), "everything switched off");
            if ((await question("Everything is off. Does it still flash?", ["Gone", "Still flashes", "Stop"])) !== "Gone") {
                say("Not caused by these effects (or you stopped).");
                return;
            }
            while (pool.length > 1) {
                const half = pool.slice(0, Math.ceil(pool.length / 2));
                await watch(new Set(half), `${half.length} of ${pool.length} switched off`);
                const a = await question(`${half.length} of ${pool.length} are off. Does it still flash?`, ["Gone", "Still flashes", "Stop"]);
                if (a === "Stop") {
                    say("Stopped.");
                    return;
                }
                pool = a === "Gone" ? half : pool.slice(half.length);
            }
            say(`Culprit: ${label(pool[0])}. It is now switched off in Switches.`);
            if (apply === applyFeatures) {
                on.add(pool[0]);
            }
            else {
                animsOff.add(pool[0]);
            }
        });
    }
    const applyFeatures = (s: ReadonlySet<string>) => paint(s, animsOff);
    const applyAnims = (s: ReadonlySet<string>) => paint(on, s);

    /* ---------- tabs ---------- */
    const status = (lvl: Health | "info" | string, text: string) => h("span", "dbgtag " + lvl, text);

    function liveTab(): HTMLElement {
        const wrap = h("div");
        const cv = h("canvas", "dbgcv");
        const mk = (label: string) => {
            const val = h("b", null, "-");
            const box = h("div", "dbgs", val, h("small", null, label));
            return { box, val };
        };
        const cells = {
            fps: mk("fps"),
            p95: mk("p95 frame ms"),
            worst: mk("worst frame ms"),
            late: mk("late frames"),
            lost: mk("ms lost / s"),
            lag: mk("timer lag ms (15 s)"),
            long: mk("long tasks (15 s)"),
            cls: mk("layout shift"),
            dom: mk("DOM nodes"),
            anim: mk("animations"),
            heap: mk("JS heap MB"),
            hz: mk("display Hz")
        };
        const grid = h("div", "dbgg", ...Object.values(cells).map(c => c.box));
        const verdict = h("div");
        const ctx = h("div");
        wrap.append(cv, grid, h("div", "dbgh4", "What is going on"), verdict, h("div", "dbgh4", "Cost per screen"), ctx);
        let lastVerdict = "";
        let n = 0;
        const set = (c: { box: HTMLElement; val: HTMLElement }, text: string, lvl: Health | "" = "") => {
            c.val.textContent = text;
            c.box.className = "dbgs " + lvl;
        };
        live = () => {
            const s = monitor.summary(120);
            const hl = healthOf(s, monitor.budget);
            drawSpark(cv, monitor.recent(120), monitor.budget);
            set(cells.fps, fmt(s.fps, 0), hl);
            set(cells.p95, fmt(s.p95), s.p95 > monitor.budget * 1.5 ? "bad" : s.p95 > monitor.budget * 1.25 ? "warn" : "ok");
            set(cells.worst, fmt(s.worst, 0), s.worst > 100 ? "bad" : s.worst > monitor.budget * 2.5 ? "warn" : "ok");
            set(cells.late, `${s.late}/${s.frames}`, s.lateRatio > 0.1 ? "bad" : s.lateRatio > 0.02 ? "warn" : "ok");
            set(cells.lost, fmt(s.lostPerSec, 0), s.lostPerSec > 40 ? "bad" : s.lostPerSec > 8 ? "warn" : "ok");
            const ev = monitor.eventsSince(15000);
            const lags = ev.filter(e => e.kind === "lag");
            const longs = ev.filter(e => e.kind === "loaf" || e.kind === "longtask");
            set(cells.lag, lags.length ? fmt(Math.max(...lags.map(e => e.dur)), 0) : "0", lags.length ? "warn" : "ok");
            set(cells.long, monitor.support.longtask || monitor.support.loaf ? String(longs.length) : "n/a", longs.length ? "bad" : "");
            set(cells.cls, fmt(monitor.cls, 3), monitor.cls > 0.1 ? "warn" : "");
            set(cells.dom, String(monitor.dom), monitor.dom > 1500 ? "warn" : "");
            set(cells.anim, String(monitor.anims), monitor.anims > 40 ? "warn" : "");
            set(cells.heap, monitor.support.heap ? fmt(monitor.heapMb, 0) : "n/a");
            set(cells.hz, String(Math.round(1000 / monitor.budget)), monitor.budget > 30 ? "warn" : "");
            title.textContent = `${ctxLabel()}`;
            if (n++ % 4 === 0) {
                const fs = findings();
                const key = fs.map(f => f.level + f.title + (f.detail ?? "")).join("|");
                if (key !== lastVerdict) {
                    lastVerdict = key;
                    verdict.replaceChildren(...fs.map(findingEl));
                }
                const rows = [...monitor.byCtx.values()].filter(c => c.frames >= 20).sort((a, b) => b.lost / b.ms - a.lost / a.ms);
                ctx.replaceChildren(
                    rows.length
                        ? h(
                              "table",
                              "dbgt",
                              h("tr", null, h("th", null, "screen"), h("th", null, "late"), h("th", null, "worst"), h("th", null, "lost/s")),
                              ...rows.slice(0, 8).map(c => h("tr", null, h("td", null, c.key), h("td", null, fmt((c.late / c.frames) * 100, 0) + "%"), h("td", null, fmt(c.worst, 0)), h("td", null, fmt((c.lost / c.ms) * 1000, 0))))
                          )
                        : h("p", "dbgmut", "Walk through the app: each screen gets its own line.")
                );
            }
        };
        live();
        return wrap;
    }

    const findingEl = (f: Finding) => h("div", "dbgfind " + f.level, h("b", null, f.title), f.detail ? h("span", null, f.detail) : null);

    function findings(): Finding[] {
        const wt = monitor.worstTap();
        return diagnose({
            summary: monitor.summary(),
            budget: monitor.budget,
            events: monitor.eventsSince(15000),
            audit,
            anims,
            cls: monitor.cls,
            tapWorst: wt?.worst ?? 0,
            tapWorstLabel: wt?.key,
            heapGrowthMb: monitor.heapMb - monitor.heapStartMb,
            heapMinutes: monitor.heapStartAt ? (performance.now() - monitor.heapStartAt) / 60000 : 0,
            touch: matchMedia("(hover:none),(pointer:coarse)").matches,
            lite: state.lite,
            supportsLongTasks: monitor.support.longtask || monitor.support.loaf
        });
    }

    function segmented<T extends string | number>(options: readonly (readonly [T, string])[], current: T, pick: (v: T) => void): HTMLElement {
        const row = h("div", "dbgrow");
        for (const [v, label] of options) {
            const b = btn(label, () => {
                pick(v);
                scheduleRender();
            }, "alt");
            b.setAttribute("aria-pressed", String(v === current));
            row.append(b);
        }
        return row;
    }

    function profileView(p: ProfileResult): HTMLElement {
        const out = h("div");
        if (!p.base) {
            out.append(h("p", null, "Warming up..."));
            return out;
        }
        const base = `${fmt(p.base.frames.fps, 0)} fps, ${fmt(p.ref)} ms lost per second`;
        if (p.status === "running" && !p.rows.length) {
            out.append(h("p", null, `Baseline: ${base}`));
            return out;
        }
        if (p.status === "smooth") {
            out.append(
                h("div", "dbgfind ok", h("b", null, "Already smooth here"), h("span", null, `${base}. Nothing to win. Try Stress, another scenario, or a weaker device.`)),
                btn("Test every effect anyway", () => void autoProfile(true), "alt")
            );
            return out;
        }
        if (p.status === "no-css-gain") {
            out.append(
                h(
                    "div",
                    "dbgfind warn",
                    h("b", null, "The cost is not in these effects"),
                    h("span", null, `${base}. Switching ALL of them off wins back only ${fmt(p.ceiling?.gain ?? 0)} ms/s. Look at JavaScript: Log tab (long tasks / scripts), or at DOM size in Audit.`)
                ),
                btn("Test each effect anyway", () => void autoProfile(true), "alt")
            );
            return out;
        }
        out.append(h("p", null, `Baseline: ${base}. Noise level: ${fmt(p.threshold)} ms/s.${p.drift !== undefined && p.drift > p.threshold ? " The device was unsteady (" + fmt(p.drift) + " ms/s drift between checks): treat close results with care." : ""}`));
        if (p.ceiling) {
            out.append(h("p", "dbgmut", `Everything off: ${fmt(p.ceiling.run.frames.lostPerSec)} ms/s (best possible gain ${fmt(p.ceiling.gain)}).`));
        }
        const max = Math.max(1, ...p.rows.map(r => r.gain));
        for (const r of p.rows.slice(0, 14)) {
            const isOn = r.kind === "feature" ? on.has(r.id) : animsOff.has(r.id);
            const bar = r.gain > 0 ? h("div", "dbgbar" + (r.significant ? "" : " neg")) : null;
            if (bar) {
                bar.style.width = Math.max(2, (r.gain / max) * 100) + "%";
            }
            const cb = h("input");
            cb.type = "checkbox";
            cb.checked = isOn;
            cb.setAttribute("aria-label", "Switch off " + r.name);
            cb.onchange = () => (r.kind === "feature" ? toggleFeature(r.id, cb.checked) : toggleAnim(r.id, cb.checked));
            out.append(
                h(
                    "label",
                    "dbgr",
                    cb,
                    h(
                        "span",
                        null,
                        (r.significant ? "\u2605 " : "") + r.name,
                        h("small", null, `${r.gain > 0 ? "wins back" : "no gain:"} ${fmt(Math.abs(r.gain))} ms/s, ${fmt(r.run.frames.fps, 0)} fps`),
                        bar
                    )
                )
            );
        }
        if (p.combined) {
            out.append(h("p", null, `Top culprits together (${p.combined.names.join(", ")}): ${fmt(score(p.combined.run))} ms/s, winning back ${fmt(p.combined.gain)}.`));
        }
        const sig = p.rows.filter(r => r.significant).slice(0, 4);
        if (sig.length) {
            out.append(
                h(
                    "div",
                    "dbgrow",
                    btn("Switch off the \u2605 culprits", () => {
                        sig.forEach(r => (r.kind === "feature" ? on.add(r.id) : animsOff.add(r.id)));
                        sync();
                        say("Switched off. Use Test once to confirm.");
                        scheduleRender();
                    }, "red")
                )
            );
        }
        else if (p.status === "done") {
            out.append(h("p", "dbgmut", "No single effect stands out from the noise: the cost is spread out. Try the Heavy stress or the combined line above."));
        }
        if (p.status === "cancelled") {
            out.append(h("p", "dbgmut", "Stopped early: partial results."));
        }
        return out;
    }

    function findTab(): HTMLElement {
        const wrap = h("div");
        wrap.append(
            h("p", null, "Measures how many milliseconds per second are lost to late frames, switches each effect off one at a time and ranks them. Runs on the current screen."),
            h("div", "dbgh4", "Scenario"),
            segmented(SCENARIOS, scenario, v => {
                scenario = v;
                seen = new Map();
            }),
            h("div", "dbgh4", "Stress: simulate a slower phone"),
            segmented(STRESS, stress, v => (stress = v)),
            h("div", "dbgrow", btn("Auto-profile", () => void autoProfile(false), "red"), btn("Test once", () => void testOnce(), "alt"))
        );
        if (profile) {
            wrap.append(h("div", "dbgh4", "Result"), profileView(profile));
        }
        wrap.append(
            h("div", "dbgh4", "Guided hunt (for flashes the numbers cannot see)"),
            h("p", "dbgmut", "You watch, it halves the suspects until one is left."),
            h(
                "div",
                "dbgrow",
                btn("Hunt: effects", () => void hunt(async () => REDUCERS.filter(f => applicable(f, usedFeatures())).map(f => f.id), applyFeatures, id => FEATURES.find(f => f.id === id)?.name ?? id), "alt"),
                btn("Hunt: animations", () => void hunt(async () => (await ensureScan(), animNames()), applyAnims, id => "@keyframes " + id), "alt")
            )
        );
        return wrap;
    }

    function animTab(): HTMLElement {
        anims = inspectAnimations();
        const wrap = h("div");
        wrap.append(h("div", "dbgrow", btn("Refresh", scheduleRender, "alt")));
        if (!anims.length) {
            wrap.append(h("p", null, "Nothing is animating right now."));
        }
        wrap.append(h("p", "dbgmut", "Cost: cheap = compositor only (transform, opacity). gpu = filter. paint = repaints every frame. layout = reflows every frame. Off-screen = running while invisible."));
        for (const a of anims) {
            const cb = h("input");
            cb.type = "checkbox";
            cb.disabled = !a.killable;
            cb.checked = animsOff.has(a.name);
            cb.setAttribute("aria-label", "Switch off " + a.name);
            cb.onchange = () => toggleAnim(a.name, cb.checked);
            wrap.append(
                h(
                    "label",
                    "dbgr",
                    cb,
                    h(
                        "span",
                        null,
                        status(a.cost, a.cost),
                        `${a.name} x${a.count}`,
                        h("small", null, `${a.type}, ${a.running} running${a.infinite ? ", infinite" : ""}${a.offscreen ? `, ${a.offscreen} OFF-SCREEN` : ""}. Animates: ${a.props.join(", ") || "?"}. e.g. ${a.sample}`)
                    )
                )
            );
        }
        return wrap;
    }

    function auditTab(): HTMLElement {
        const wrap = h("div");
        const out = h("div");
        const run = btn(audit ? "Run audit again" : "Run audit", () => {
            run.disabled = true;
            run.textContent = "Scanning...";
            void auditPage(root).then(a => {
                audit = a;
                scheduleRender();
            });
        });
        wrap.append(h("div", "dbgrow", run), out);
        if (!audit) {
            out.append(h("p", null, "Scans every element's computed style for backdrop-filter, blur, blend modes, masks, big shadows, forced layers, SMIL, heavy images, and times a full style pass. A few hundred ms on a phone."));
            return wrap;
        }
        const a = audit;
        const c = a.counts;
        const cell = (label: string, v: number | string, lvl: Health | "" = "") => h("div", "dbgs " + lvl, h("b", null, String(v)), h("small", null, label));
        out.append(
            h(
                "div",
                "dbgg",
                cell("DOM nodes", a.dom, a.dom > 1500 ? "warn" : ""),
                cell("max depth", a.depth, a.depth > 32 ? "warn" : ""),
                cell("style+layout ms", fmt(a.styleMs), a.styleMs > 8 ? "warn" : ""),
                cell("backdrop-filter", c.backdrop, c.backdrop ? "bad" : ""),
                cell("blur filters", c.blur, c.blur ? "warn" : ""),
                cell("blend modes", c.blend, c.blend ? "warn" : ""),
                cell("masks", c.mask, c.mask ? "warn" : ""),
                cell("big shadows", c.shadow, c.shadow > 10 ? "warn" : ""),
                cell("will-change", c.willChange, c.willChange > 15 ? "warn" : ""),
                cell("backface layers", c.backface, c.backface > 15 ? "warn" : ""),
                cell("SMIL (live)", a.smil, a.smil ? "warn" : ""),
                cell("SVG nodes", a.svgNodes)
            ),
            h("p", "dbgmut", `Scanned ${a.scanned} of ${a.dom} elements ${ago(Date.now() - a.at).replace(" ago", "")} ago. Images ${fmt(a.imageMb, 1)} MB decoded.`),
            h("div", "dbgh4", "Heaviest elements (weight x size)")
        );
        if (!a.suspects.length) {
            out.append(h("p", null, "No expensive CSS found."));
        }
        for (const s of a.suspects) {
            out.append(h("div", "dbgev", h("b", null, `${s.sel}${s.n > 1 ? " x" + s.n : ""}`), h("small", null, s.why)));
        }
        if (a.images.length) {
            out.append(h("div", "dbgh4", "Biggest images"));
            for (const m of a.images) {
                out.append(h("div", "dbgev", h("b", null, m.src), h("small", null, `${fmt(m.mb, 1)} MB decoded, ${fmt(m.oversize, 1)}x larger than drawn`)));
            }
        }
        return wrap;
    }

    function flashTab(): HTMLElement {
        const wrap = h("div");
        wrap.append(
            h("p", "dbgmut", "Finds flashes that fps cannot show. Press Start: the panel hides, then do the thing that flashes (for example open Categories and tap a tile). For 1.2 s after every tap this records what changed: elements re-created, animations and transitions, containers that changed opacity or background, layout shifts. Then open the panel again and read the suspects.")
        );
        wrap.append(
            h(
                "div",
                "dbgrow",
                btn(flash.armed ? "Stop recording" : "Start (hides panel)", () => {
                    if (flash.armed) {
                        flash.disarm();
                        say("Recording stopped.");
                    }
                    else {
                        flash.arm();
                        setOpen(false);
                    }
                    scheduleRender();
                }, flash.armed ? "red" : ""),
                btn("Copy flash log", () => {
                    void copyText(flash.toText()).then(ok => {
                        say(ok ? "Flash log copied. Paste it to whoever is helping you." : "Could not copy: use Copy report instead.");
                    });
                }, "alt"),
                btn("Clear", () => flash.clear(), "alt")
            )
        );
        if (!flash.captures.length) {
            wrap.append(h("p", null, flash.armed ? "Recording is on. Tap what flashes, then come back here." : "No captures yet."));
            return wrap;
        }
        for (const c of flash.captures) {
            const box = h("div", "dbgev", status(c.suspects.length && !c.suspects[0].startsWith("Nothing") ? "bad" : "warn", `#${c.id}`), `${c.target}`, h("small", null, `${c.clock} | ${c.frames} frames, worst ${fmt(c.worst, 0)} ms | ${c.lines.length} events`));
            for (const sus of c.suspects) {
                box.append(h("p", null, sus));
            }
            const det = h("details");
            det.append(h("summary", null, "All events"));
            const pre = h("pre", "dbgpre");
            pre.textContent = c.lines.map(l => `${l.t.toFixed(0).padStart(5)} ms ${l.kind} ${l.text}`).join("\n");
            det.append(pre);
            box.append(det);
            wrap.append(box);
        }
        return wrap;
    }

    function logTab(): HTMLElement {
        const wrap = h("div");
        wrap.append(
            h(
                "div",
                "dbgrow",
                btn("Mark this moment", () => {
                    monitor.mark("manual mark");
                    scheduleRender();
                }, "alt"),
                btn("Clear", () => {
                    monitor.clearEvents();
                    scheduleRender();
                }, "alt")
            )
        );
        if (!monitor.support.loaf && !monitor.support.longtask) {
            wrap.append(h("p", "dbgmut", "This browser reports no long tasks (iOS Safari): frame gaps and timer delays are logged instead."));
        }
        const taps = [...monitor.taps.values()].sort((a, b) => b.worst - a.worst).slice(0, 6);
        if (taps.length) {
            wrap.append(
                h("div", "dbgh4", "Slow taps (worst first)"),
                h(
                    "table",
                    "dbgt",
                    h("tr", null, h("th", null, "tap"), h("th", null, "total"), h("th", null, "wait"), h("th", null, "code"), h("th", null, "paint")),
                    ...taps.map(t => h("tr", null, h("td", null, t.key), h("td", null, fmt(t.worst, 0)), h("td", null, fmt(t.input, 0)), h("td", null, fmt(t.proc, 0)), h("td", null, fmt(t.present, 0))))
                )
            );
        }
        wrap.append(h("div", "dbgh4", "Events (newest first)"));
        const now = performance.now();
        const ev = monitor.events.slice(-60).reverse();
        if (!ev.length) {
            wrap.append(h("p", null, "Nothing yet. Long tasks, frame gaps, slow taps and layout shifts appear here, tagged with the screen they happened on."));
        }
        for (const e of ev) {
            wrap.append(h("div", "dbgev", status(e.kind === "mark" ? "info" : e.dur > 100 ? "bad" : "warn", e.kind), `${e.dur ? fmt(e.dur, 0) + " ms " : ""}${e.label}`, h("small", null, `${ago(now - e.t)} on ${e.ctx}${e.detail ? " | " + e.detail : ""}`)));
        }
        return wrap;
    }

    function switchTab(): HTMLElement {
        const wrap = h("div");
        wrap.append(
            h(
                "div",
                "dbgrow",
                btn("All off", () => {
                    on = new Set(REDUCERS.map(f => f.id));
                    sync();
                    scheduleRender();
                }, "alt"),
                btn("Reset", () => {
                    on = new Set();
                    animsOff = new Set();
                    sync();
                    scheduleRender();
                }, "alt")
            ),
            h("p", "dbgmut", "A ticked box switches that effect OFF, so you can see what it costs. Saved on this device.")
        );
        const row = (label: string, hint: string, checked: boolean, change: (v: boolean) => void) => {
            const cb = h("input");
            cb.type = "checkbox";
            cb.checked = checked;
            cb.onchange = () => change(cb.checked);
            return h("label", "dbgr", cb, h("span", null, label, h("small", null, hint)));
        };
        for (const g of featureGroups()) {
            wrap.append(h("div", "dbgh4", g.group));
            for (const f of g.items) {
                wrap.append(row(f.name, f.hint, on.has(f.id), v => toggleFeature(f.id, v)));
            }
        }
        const names = animNames();
        if (names.length) {
            wrap.append(h("div", "dbgh4", "Single @keyframes"));
            for (const n of names) {
                wrap.append(row(n, seen.get(n) ? [...seen.get(n)!.states].join(", ") : "running now", animsOff.has(n), v => toggleAnim(n, v)));
            }
        }
        return wrap;
    }

    /* ---------- render ---------- */
    let live: () => void = () => {};
    let renderQueued = false;
    function scheduleRender(): void {
        if (renderQueued) {
            return;
        }
        renderQueued = true;
        requestAnimationFrame(() => {
            renderQueued = false;
            render();
        });
    }

    flash.onChange = () => {
        fab.classList.toggle("rec", flash.armed);
        scheduleRender();
    };
    flash.onRecording = on => {
        fab.classList.toggle("hit", on);
    };

    function render(): void {
        tabsEl.replaceChildren(
            ...TABS.map(([id, label]) => {
                const b = h("button", "dbgtab", label);
                b.type = "button";
                b.setAttribute("role", "tab");
                b.setAttribute("aria-selected", String(id === tab));
                b.onclick = () => {
                    tab = id;
                    writeJson(K_TAB, id);
                    render();
                };
                return b;
            })
        );
        live = () => {};
        const scroll = body.scrollTop;
        const view = tab === "live" ? liveTab() : tab === "find" ? findTab() : tab === "flash" ? flashTab() : tab === "anim" ? animTab() : tab === "audit" ? auditTab() : tab === "log" ? logTab() : switchTab();
        if (reportText) {
            const ta = h("textarea");
            ta.value = reportText;
            ta.readOnly = true;
            ta.onfocus = () => ta.select();
            view.append(h("div", "dbgh4", "Report (select all and copy)"), ta);
        }
        body.replaceChildren(view);
        body.scrollTop = scroll;
    }

    function setOpen(v: boolean): void {
        open = v;
        panel.hidden = !v;
        fab.hidden = v;
        if (v) {
            render();
        }
    }

    /* ---------- footer ---------- */
    async function makeReport(): Promise<string> {
        env = await collectEnv(state.lite);
        anims = anims ?? inspectAnimations();
        return buildReport({ flash: flash.captures.length ? flash.toText() : "", env, monitor, summary: monitor.summary(), findings: findings(), profile, anims, audit, featuresOff: [...on], animsOff: [...animsOff], screen: ctxLabel() });
    }
    foot.append(
        btn("Copy report", () => {
            void makeReport().then(async text => {
                if (await copyText(text)) {
                    reportText = "";
                    say("Report copied. Paste it to whoever is helping you.");
                }
                else {
                    reportText = text;
                    say("Could not copy automatically: select the text at the bottom of the tab.");
                }
                scheduleRender();
            });
        }, "red")
    );
    if (typeof navigator.share === "function") {
        foot.append(
            btn("Share", () => {
                void makeReport().then(text => navigator.share({ title: "Intrus performance report", text }).catch(() => {}));
            }, "alt")
        );
    }
    foot.append(
        btn("Reset all", () => {
            on = new Set();
            animsOff = new Set();
            profile = null;
            audit = null;
            seen = new Map();
            reportText = "";
            monitor.clearEvents();
            sync();
            say("Everything reset.");
            scheduleRender();
        }, "alt")
    );

    /* ---------- pill: tap = open, drag = move, long press = mark ---------- */
    const placeFab = (x: number, y: number) => {
        const w = fab.offsetWidth || 46;
        const ht = fab.offsetHeight || 46;
        fab.style.left = Math.min(Math.max(4, x), innerWidth - w - 4) + "px";
        fab.style.top = Math.min(Math.max(4, y), innerHeight - ht - 4) + "px";
        fab.style.marginTop = "0";
    };
    const pos = readJson<{ x: number; y: number } | null>(K_POS, null);
    if (pos) {
        placeFab(pos.x, pos.y);
    }
    let drag: { id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean; long: boolean; timer: number } | null = null;
    fab.addEventListener("pointerdown", e => {
        const r = fab.getBoundingClientRect();
        fab.setPointerCapture(e.pointerId);
        const d = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false, long: false, timer: 0 };
        d.timer = window.setTimeout(() => {
            if (!d.moved) {
                d.long = true;
                monitor.mark("manual mark (long press)");
                navigator.vibrate?.(30);
                fab.classList.add("hit");
                setTimeout(() => fab.classList.remove("hit"), 600);
            }
        }, 600);
        drag = d;
    });
    fab.addEventListener("pointermove", e => {
        if (!drag || e.pointerId !== drag.id) {
            return;
        }
        const dx = e.clientX - drag.sx;
        const dy = e.clientY - drag.sy;
        if (!drag.moved && Math.hypot(dx, dy) > 8) {
            drag.moved = true;
        }
        if (drag.moved) {
            placeFab(drag.ox + dx, drag.oy + dy);
        }
    });
    const endDrag = (e: PointerEvent, cancelled: boolean) => {
        if (!drag || e.pointerId !== drag.id) {
            return;
        }
        clearTimeout(drag.timer);
        const d = drag;
        drag = null;
        if (d.moved) {
            const r = fab.getBoundingClientRect();
            writeJson(K_POS, { x: r.left, y: r.top });
        }
        else if (!d.long && !cancelled) {
            setOpen(true);
        }
    };
    fab.addEventListener("pointerup", e => endDrag(e, false));
    fab.addEventListener("pointercancel", e => endDrag(e, true));
    fab.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
        }
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && open && !busy) {
            setOpen(false);
        }
    });

    /* ---------- heartbeat (4 Hz: cheap, and the page may be hidden) ---------- */
    let lastEv: unknown = null;
    let hitTimer = 0;
    let tickNo = 0;
    const tick = () => {
        if (document.hidden) {
            return;
        }
        const s = monitor.summary(120);
        fabNum.textContent = s.frames ? String(Math.round(s.fps)) : "-";
        fab.classList.remove("ok", "warn", "bad");
        fab.classList.add(healthOf(s, monitor.budget));
        const e = monitor.events[monitor.events.length - 1];
        if (e && e !== lastEv) {
            lastEv = e;
            if (e.kind !== "mark" && e.dur >= 100) {
                fab.classList.add("hit");
                clearTimeout(hitTimer);
                hitTimer = window.setTimeout(() => fab.classList.remove("hit"), 1500);
            }
        }
        if (open && !busy) {
            if (tab === "live") {
                live();
            }
            else if (tab === "log" && evDirty && tickNo % 4 === 0) {
                evDirty = false;
                scheduleRender();
            }
        }
        tickNo++;
    };
    setInterval(tick, 250);

    /* taps on the debugger itself are not the app's slow taps */
    let ownFrom = 0;
    let ownTo = 0;
    root.addEventListener(
        "pointerdown",
        e => {
            ownFrom = e.timeStamp - 5;
            ownTo = Infinity;
        },
        true
    );
    for (const t of ["pointerup", "pointercancel", "click"]) {
        root.addEventListener(t, e => (ownTo = e.timeStamp + 150), true);
    }
    monitor.ignoreTap = start => start >= ownFrom && start <= ownTo;

    paint(on, animsOff);
    monitor.start();
    void collectEnv(state.lite).then(e => (env = e));
    say("");
}
