import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The native run journal bridge (O-01 native layer, F1/F2): the watcher starts and stops native recording for the
 * recording's key, recovery merges natively written fixes without counting any twice, and sign-out / account deletion
 * remove the routes kept on the device.
 */
const calls: { plugin: string; method: string; args: unknown }[] = [];
let nativeFixes: { lat: number; lng: number; accuracy: number; t: number }[] = [];
let native = true;
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => native, getPlatform: () => "ios" },
  registerPlugin: (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) => async (args: unknown) => {
          calls.push({ plugin: name, method, args });
          if (name === "BackgroundGeolocation" && method === "addWatcher") return "w1";
          if (name === "RunJournal" && method === "start") return { recording: true, authorized: true };
          if (name === "RunJournal" && method === "read") return { fixes: nativeFixes };
          return undefined;
        },
      },
    ),
}));

beforeEach(() => {
  calls.length = 0;
  nativeFixes = [];
  native = true;
  localStorage.clear();
  vi.resetModules();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("native run journal", () => {
  it("is a no-op in a browser", async () => {
    native = false;
    const rj = await import("@/lib/native/run-journal");
    expect(await rj.startNativeRunJournal("run.recording.u1")).toBe(false);
    expect(await rj.readNativeRunJournal("run.recording.u1")).toEqual([]);
    await rj.clearNativeRunJournal();
    expect(calls).toEqual([]);
  });

  it("the GPS watcher records natively under the recording's key until it is stopped", async () => {
    const { watchLocation } = await import("@/lib/native/location");
    const stop = await watchLocation(() => undefined, () => undefined, "run.recording.u1");
    await flush();
    expect(calls).toContainEqual({ plugin: "RunJournal", method: "start", args: { key: "run.recording.u1" } });
    stop();
    await flush();
    expect(calls.filter((c) => c.plugin === "RunJournal").map((c) => c.method)).toEqual(["start", "stop"]);
  });

  it("recovery merges natively written fixes, skipping those the saved track already has and invalid ones", async () => {
    const { addFix, startTrack, trackTotals } = await import("@/lib/domain/gps-track");
    const { replayFixes } = await import("@/lib/run/fix-journal");
    const T0 = Date.UTC(2026, 10, 26, 7);
    const at = (i: number) => ({ lat: 40 + (i * 3) / 111_195, lng: -75, accuracy: 5, t: T0 + 1000 + i * 1000 });
    let track = startTrack({ id: "r1", kind: "run", unit: "km", now: T0 });
    for (let i = 0; i <= 60; i++) track = addFix(track, at(i)).state; // 180 m saved
    nativeFixes = [...Array.from({ length: 361 }, (_, i) => at(i)), { lat: Number.NaN, lng: -75, accuracy: 5, t: T0 + 999_999 }];
    const { readNativeRunJournal } = await import("@/lib/native/run-journal");
    const merged = replayFixes(track, await readNativeRunJournal("run.recording.u1"));
    expect(trackTotals(merged).distance_m).toBeGreaterThan(1000); // 360 s at 3 m/s ≈ 1,080 m in all
    expect(trackTotals(merged).distance_m).toBeLessThan(1150); // nothing counted twice
    expect(merged.lastFixAt).toBe(at(360).t);
  });

  it("sign-out removes that member's web and native journals only; account deletion removes all", async () => {
    localStorage.setItem("run.fixjournal", JSON.stringify({ key: "run.recording.u1", fixes: [[40, -75, 5, 1]] }));
    const { clearAllDrafts } = await import("@/lib/drafts");
    clearAllDrafts("u2");
    await flush();
    expect(localStorage.getItem("run.fixjournal")).not.toBeNull(); // another member's journal is left
    expect(calls).toContainEqual({ plugin: "RunJournal", method: "clear", args: { key: "run.recording.u2" } });
    calls.length = 0;
    clearAllDrafts("u1");
    await flush();
    expect(localStorage.getItem("run.fixjournal")).toBeNull();
    expect(calls).toContainEqual({ plugin: "RunJournal", method: "clear", args: { key: "run.recording.u1" } });
    calls.length = 0;
    localStorage.setItem("run.fixjournal", JSON.stringify({ key: "run.recording.u3", fixes: [] }));
    clearAllDrafts(); // account deleted / device forgotten
    await flush();
    expect(localStorage.getItem("run.fixjournal")).toBeNull();
    expect(calls).toContainEqual({ plugin: "RunJournal", method: "clear", args: {} });
  });
});
