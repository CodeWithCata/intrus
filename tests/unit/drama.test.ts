/** Vote drama and the fake-out: the order of the steps, and the fake never touching the real result. */
import { describe, expect, it } from "vitest";
import { FAKE_CHANCE, MAX_DRAMA_MS, TALLY_MS, pickFake, planReveal, runPlan, shouldFake, tallyOrder, tallyStep, type DramaStep, type Timers } from "#lib/game/drama.ts";

const seq = (...v: number[]) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const base = { calm: false, troll: false, n: 5, intr: [2] };

/** A fake clock: timers fire in time order when advance() is called. */
const clock = () => {
  let now = 0, id = 0;
  const q: { id: number; at: number; fn: () => void }[] = [];
  const timers: Timers = { set: (fn, ms) => { q.push({ id: ++id, at: now + ms, fn }); return id; }, clear: (x) => { const k = q.findIndex(t => t.id === x); if (k >= 0) q.splice(k, 1); } };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      q.sort((a, b) => a.at - b.at);
      if (!q.length || q[0].at > end) break;
      const t = q.shift()!; now = t.at; t.fn();
    }
    now = end;
  };
  return { timers, advance };
};

describe("planReveal", () => {
  it("plays a drumroll and then the real result, in that order", () => {
    const p = planReveal({ ...base, rng: seq(0.9) }); // 0.9 >= FAKE_CHANCE: no fake-out
    expect(p.steps.map(s => s.kind)).toEqual(["roll", "reveal"]);
    expect(p.fake).toBeNull();
    expect(p.steps[0].at < p.steps[1].at).toBe(true);
  });

  it("a fake-out is roll, fake, flip, reveal and points at an innocent player", () => {
    const p = planReveal({ ...base, rng: seq(0.1, 0.0) });
    expect(p.steps.map(s => s.kind)).toEqual(["roll", "fake", "flip", "reveal"]);
    expect(p.fake).not.toBe(2);
    expect(p.steps[1].target).toBe(p.fake);
    for (let i = 1; i < p.steps.length; i++) expect(p.steps[i].at > p.steps[i - 1].at).toBe(true);
  });

  it("never holds the information back longer than ~3 seconds", () => {
    for (const r of [0.0, 0.5, 0.99]) expect(planReveal({ ...base, rng: seq(r, r) }).totalMs <= MAX_DRAMA_MS).toBe(true);
    expect(tallyStep(12) * 12 <= TALLY_MS).toBe(true);
  });

  it("is a single immediate reveal when calm (lite, reduced motion, relaxed) or switched off", () => {
    for (const o of [{ ...base, calm: true }, { ...base, drama: false }]) {
      const p = planReveal({ ...o, rng: seq(0) });
      expect(p.steps).toEqual([{ kind: "reveal", at: 0 }]);
      expect(p.fake).toBeNull();
      expect(p.totalMs).toBe(0);
    }
  });

  it("never fakes in a troll round, when calm, or when nobody is innocent", () => {
    const always = seq(0);
    expect(shouldFake({ ...base, troll: true }, always)).toBe(false);
    expect(shouldFake({ ...base, calm: true }, always)).toBe(false);
    expect(shouldFake({ ...base, intr: [0, 1, 2, 3, 4] }, always)).toBe(false);
    expect(shouldFake({ ...base }, always)).toBe(true);
    expect(shouldFake({ ...base }, seq(FAKE_CHANCE))).toBe(false); // exactly at the threshold: no
  });

  it("about 1 reveal in 4 gets a fake-out", () => {
    let k = 0, rnd = 12345;
    const rng = () => ((rnd = (rnd * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let i = 0; i < 4000; i++) if (planReveal({ ...base, rng }).fake !== null) k++;
    expect(k > 800 && k < 1200).toBe(true);
  });
});

describe("pickFake", () => {
  it("is deterministic with an injected rng and never an intruder", () => {
    for (let n = 3; n <= 12; n++) {
      const intr = [0, n - 1];
      for (const r of [0, 0.3, 0.7, 0.999]) {
        const f = pickFake(n, intr, () => r)!;
        expect(intr.includes(f)).toBe(false);
        expect(pickFake(n, intr, () => r)).toBe(f);
      }
    }
    expect(pickFake(3, [0, 1, 2])).toBeNull();
  });
});

describe("the fake-out never affects the outcome", () => {
  it("planReveal does not read or change the real result", () => {
    const intr = Object.freeze([1, 4]) as readonly number[];
    const before = JSON.stringify(intr);
    const p = planReveal({ ...base, n: 6, intr, rng: seq(0.05, 0.5) });
    expect(JSON.stringify(intr)).toBe(before);
    expect(p.fake !== null && intr.includes(p.fake)).toBe(false);
    // the plan always ends with the real reveal, so scoring (which reads round.intr / round.top only) is unaffected by it
    expect(p.steps[p.steps.length - 1].kind).toBe("reveal");
  });
});

describe("runPlan", () => {
  it("plays the steps in order at their times", () => {
    const c = clock();
    const seen: string[] = [];
    runPlan(planReveal({ ...base, rng: seq(0.1, 0) }).steps, (s: DramaStep) => seen.push(s.kind), c.timers);
    expect(seen).toEqual(["roll"]);
    c.advance(900);
    expect(seen).toEqual(["roll", "fake"]);
    c.advance(5000);
    expect(seen).toEqual(["roll", "fake", "flip", "reveal"]);
  });

  it("skipping jumps straight to the real reveal, once", () => {
    const c = clock();
    const seen: string[] = [];
    const stop = runPlan(planReveal({ ...base, rng: seq(0.1, 0) }).steps, (s) => seen.push(s.kind), c.timers);
    stop(true);
    c.advance(5000);
    expect(seen).toEqual(["roll", "reveal"]);
    stop(true);
    expect(seen).toEqual(["roll", "reveal"]);
  });
});

describe("tally order", () => {
  it("shows the fewest votes first and the most voted last", () => {
    expect(tallyOrder({ 0: 1, 2: 3 }, 4)).toEqual([1, 3, 0, 2]);
    expect(tallyOrder({}, 3)).toEqual([0, 1, 2]);
  });
});
