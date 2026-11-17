/**
 * Reliability closure (2026-11-17, docs/launch-readiness/04_RELIABILITY_CLOSURE.md): the gaps left after the earlier
 * workout, GPS and offline tests. Pure logic only; the browser side is e2e/reliability-closure.spec.ts.
 *
 * Every trace and clock below is synthetic. What a real phone's clock, GPS chip or service-worker update does is on the
 * physical-device list in that document.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { addFix, startTrack, suspendAwareTicker, trackTotals, type GpsFix, type TrackState } from "@/lib/domain/gps-track";
import { createDraft, draftAgeHours, elapsedSeconds, finishPayload, restorableDraft, workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";
import { finishWorkoutSchema } from "@/lib/validation/schemas";

// ------------------------------------------------------------------------------------------- workout: device clock

const START = "2026-11-17T10:00:00.000Z";
const at = (iso: string, s: number) => new Date(Date.parse(iso) + s * 1000).toISOString();
const squat = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "back-squat",
  name: "Back Squat",
  isTimed: false,
};

function started(): WorkoutDraft {
  return createDraft({
    name: "Day 1",
    now: START,
    exercises: [{ exercise: squat, restSeconds: 90, target: { sets: 3, reps: "5" } }],
  });
}
function done(d: WorkoutDraft, index: number, now: string): WorkoutDraft {
  const e = d.exercises[0]!;
  const set = e.sets[index]!;
  const typed = workoutReducer(d, {
    type: "updateSet",
    exerciseKey: e.id,
    setId: set.id,
    patch: { weightKg: 100, reps: 5 },
  });
  return workoutReducer(typed, {
    type: "toggleSetComplete",
    exerciseKey: e.id,
    setId: set.id,
    now,
  });
}
const completed = (d: WorkoutDraft | null) => d?.exercises[0]!.sets.filter((s) => s.completed).length ?? 0;

describe("the phone's clock is set back during a workout (manual change, or a wrong clock corrected)", () => {
  it("Finish still sends an end time the server accepts: never before the start (the database refuses ended_at < started_at)", () => {
    // Started at 10:00 by the phone's clock; the clock is then put back two hours and Finish is tapped at 8:20.
    const d = done(started(), 0, at(START, 120));
    const payload = finishPayload(d, at(START, -100 * 60));
    expect(finishWorkoutSchema.safeParse(payload).success).toBe(true);
    expect(Date.parse(payload.endedAt)).toBeGreaterThanOrEqual(Date.parse(payload.startedAt));
    // A normal finish is untouched.
    expect(finishPayload(d, at(START, 1800)).endedAt).toBe(at(START, 1800));
  });

  it("sets logged after the clock went back still make the newer copy: a reload keeps them over an older backup", () => {
    // Set 1 at 10:02 is backed up to the account. The clock is put back an hour; set 2 is logged (offline, so only the
    // device has it). On reload the logger restores the newer of the two copies by their updatedAt.
    const backedUp = done(started(), 0, at(START, 120));
    const onDevice = done(backedUp, 1, at(START, 180 - 3600));
    expect(completed(onDevice)).toBe(2);
    expect(Date.parse(onDevice.updatedAt)).toBeGreaterThan(Date.parse(backedUp.updatedAt));
    expect(completed(restorableDraft(onDevice, backedUp, new Set()))).toBe(2);
  });

  it("time shown and the 'unfinished from earlier' age never go negative", () => {
    const d = done(started(), 0, at(START, 120));
    expect(elapsedSeconds(d, at(START, -3600))).toBe(0);
    expect(draftAgeHours(d, at(START, -3600))).toBe(0);
  });

  it("a time-zone change alone changes nothing: every stored time is a UTC instant", () => {
    const d = done(started(), 0, at(START, 120));
    for (const iso of [d.startedAt, d.updatedAt]) expect(iso).toMatch(/Z$/);
    // The same instant written with another zone's offset is the same moment.
    expect(Date.parse("2026-11-17T05:00:00.000-05:00")).toBe(Date.parse(START));
  });
});

// ---------------------------------------------------------------------------------------------------------- GPS

const T0 = Date.UTC(2026, 10, 17, 7, 0, 0);
const M_PER_DEG_LAT = 111_195;
const north = (m: number, t: number): GpsFix => ({
  lat: 40 + m / M_PER_DEG_LAT,
  lng: -75,
  accuracy: 5,
  t,
});
/** Running north at 3 m/s, one fix a second, from second `from` to `to` (inclusive). */
const run = (from: number, to: number, base = T0): GpsFix[] => Array.from({ length: to - from + 1 }, (_, i) => north((from + i) * 3, base + (from + i) * 1000));
function feed(s: TrackState, fixes: GpsFix[], step = suspendAwareTicker()): TrackState {
  for (const f of fixes) s = step(addFix(s, f).state, f.t);
  return s;
}
const fresh = () => startTrack({ id: "closure", kind: "run", unit: "km", now: T0 });

describe("GPS timestamps that jump", () => {
  it("one fix dated an hour ahead (a bad timestamp, or the clock put back afterwards) does not stop the recording", () => {
    let s = feed(fresh(), run(1, 60));
    expect(trackTotals(s).distance_m).toBeGreaterThan(160);
    s = addFix(s, north(183, T0 + 61_000 + 3_600_000)).state;
    // Four more minutes of honest running (717 m). Before the fix every one of these was "out of order" for an hour,
    // nothing was counted and the screen did not even say the signal was lost.
    s = feed(s, run(62, 300));
    const d = trackTotals(s).distance_m;
    expect(d).toBeGreaterThan(174 + 717 * 0.9);
    expect(d).toBeLessThan(174 + 717 * 1.05);
    // The jump itself is never counted as distance.
    expect(s.rejected.out_of_order).toBeLessThan(5);
  });

  it("the clock going back during a run (fixes stamped by the phone's clock) breaks the line and keeps counting", () => {
    let s = feed(fresh(), run(1, 1200));
    const before = trackTotals(s).distance_m;
    // Twenty minutes in, the phone's clock is put back ten minutes; the runner keeps going at 3 m/s for 3 minutes.
    // (A clock put back past the start of the run is on the device list: the run's own times are then wrong too.)
    s = feed(s, run(1201, 1380, T0 - 10 * 60_000), suspendAwareTicker());
    const d = trackTotals(s).distance_m;
    expect(d - before).toBeGreaterThan(540 * 0.9);
    expect(d - before).toBeLessThan(540 * 1.05);
    expect(s.gaps).toBe(1);
  });

  it("small late deliveries are still ignored, not treated as a clock change (existing behaviour kept)", () => {
    const s = feed(fresh(), run(1, 60));
    expect(addFix(s, north(150, T0 + 50_000)).reason).toBe("out_of_order");
    expect(addFix(s, north(180, T0 + 60_000)).reason).toBe("out_of_order");
  });
});

// --------------------------------------------------------------------------------------- service worker updates

/** public/sw.js against stand-in globals (the same approach as tests/unit/bible-offline.test.ts). */
function loadServiceWorker(source: string) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const stores = new Map<string, Map<string, string>>();
  const path = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, "https://app.test").pathname;
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, string>();
    stores.set(name, store);
    return {
      match: async (r: Request | string) => (store.has(path(r)) ? new Response(store.get(path(r))) : undefined),
      addAll: async (urls: string[]) => urls.forEach((u) => store.set(path(u), `cached ${u}`)),
      put: async (r: Request | string) => void store.set(path(r), "put"),
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (r: Request | string) => {
      for (const s of stores.values()) if (s.has(path(r))) return new Response(s.get(path(r)));
      return undefined;
    },
  };
  const network = { online: true };
  const fetchFn = vi.fn(async (r: Request | string) => {
    if (!network.online) throw new TypeError("Failed to fetch");
    return new Response(`network ${path(r)}`);
  });
  const self = {
    addEventListener: (t: string, h: (e: unknown) => void) => (handlers[t] = h),
    location: { origin: "https://app.test" },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  new Function("self", "caches", "fetch", source)(self, caches, fetchFn);
  const lifecycle = async (type: "install" | "activate") => {
    let p: Promise<unknown> = Promise.resolve();
    handlers[type]!({ waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  };
  const request = async (url: string, init: { method?: string; mode?: string } = {}) => {
    let responded = null as Promise<Response> | null;
    handlers.fetch!({
      request: {
        url: `https://app.test${url}`,
        method: init.method ?? "GET",
        mode: init.mode ?? "cors",
      },
      respondWith: (r: Promise<Response>) => (responded = r),
    });
    return responded ? await responded : null;
  };
  return { lifecycle, request, stores, network, fetchFn };
}

describe("a service-worker update during a workout", () => {
  const source = readFileSync(join(import.meta.dirname, "../../public/sw.js"), "utf8");

  it("installs and activates a new version without touching the workout or run kept on the device", async () => {
    localStorage.setItem("ngf.workout.draft.u1", JSON.stringify(done(started(), 0, at(START, 60))));
    localStorage.setItem("run.recording.u1", JSON.stringify({ track: { version: 2, startedAt: T0 } }));
    const before = { ...localStorage };
    // The old version's caches exist; the new version (a different VERSION string) installs and activates.
    const old = loadServiceWorker(source.replace(/const VERSION = "[^"]+"/, 'const VERSION = "ngf-v0"'));
    await old.lifecycle("install");
    const next = loadServiceWorker(source);
    for (const [k, v] of old.stores) next.stores.set(k, v);
    await next.lifecycle("install");
    await next.lifecycle("activate");
    expect([...next.stores.keys()].some((k) => k.startsWith("ngf-v0"))).toBe(false);
    expect({ ...localStorage }).toEqual(before);
    // The worker has no way to reach the device copy at all: it never names any storage but its caches.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|\.clear\(/);
  });

  it("never answers the in-progress backups or Finish (POST server actions), so they can't be swallowed or replayed", async () => {
    const sw = loadServiceWorker(source);
    await sw.lifecycle("install");
    sw.network.online = false;
    expect(await sw.request("/train/workout", { method: "POST" })).toBeNull();
  });

  it("offline, reopening the workout shows the offline page, which says the workout is kept on the device", async () => {
    const sw = loadServiceWorker(source);
    await sw.lifecycle("install");
    sw.network.online = false;
    expect(await (await sw.request("/train/workout", { mode: "navigate" }))!.text()).toBe("cached /offline.html");
    const page = readFileSync(join(import.meta.dirname, "../../public/offline.html"), "utf8");
    expect(page).toMatch(/If you were logging a workout, it's saved on this device/);
  });
});
