import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The native run journal bridge (O-01 native layer, F1/F2): the watcher starts and stops native recording for the
 * recording's key, recovery merges natively written fixes without counting any twice, and sign-out / account deletion
 * remove the routes kept on the device.
 */
const calls: { plugin: string; method: string; args: unknown }[] = [];
let nativeFixes: { lat: number; lng: number; accuracy: number; t: number }[] = [];
let native = true;
let platform = "ios";
let status: { active: boolean; key?: string } = { active: false };
let granted = true;
/** What the phone answers to clear: confirmed, refused, or (old build) nothing. */
let clearAnswer: unknown = { cleared: true };
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => native, getPlatform: () => platform },
  registerPlugin: (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) => async (args: unknown) => {
          calls.push({ plugin: name, method, args });
          if (name === "BackgroundGeolocation" && method === "addWatcher") return "w1";
          if (name === "RunJournal" && method === "start") return { recording: true, authorized: true };
          if (name === "RunJournal" && method === "read") return { fixes: nativeFixes };
          if (name === "RunJournal" && method === "status") return status;
          if (name === "RunJournal" && method === "ensurePermission") return { granted };
          if (name === "RunJournal" && method === "clear") return clearAnswer;
          return undefined;
        },
      },
    ),
}));

beforeEach(() => {
  calls.length = 0;
  nativeFixes = [];
  native = true;
  platform = "ios";
  status = { active: false };
  granted = true;
  clearAnswer = { cleared: true };
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

  it("at app start, a native journal with nothing to continue is stopped; one that can be continued keeps recording", async () => {
    const { reconcileNativeRunJournal } = await import("@/lib/native/run-journal");
    status = { active: true, key: "run.recording.u1" };
    expect(await reconcileNativeRunJournal(() => false)).toBe("stopped");
    expect(calls.map((c) => c.method)).toContain("stop");
    calls.length = 0;
    expect(await reconcileNativeRunJournal((k) => k === "run.recording.u1")).toBe("kept");
    expect(calls.map((c) => c.method)).not.toContain("stop");
    status = { active: false };
    expect(await reconcileNativeRunJournal(() => false)).toBe("none");
  });

  it("Android: location is asked for before the background watcher starts; a refusal starts nothing", async () => {
    platform = "android";
    granted = false;
    const { watchLocation } = await import("@/lib/native/location");
    const errors: string[] = [];
    await watchLocation(() => undefined, (e) => errors.push(e), "run.recording.u1");
    expect(errors).toEqual(["denied"]);
    expect(calls.some((c) => c.plugin === "BackgroundGeolocation" && c.method === "addWatcher")).toBe(false);
    granted = true;
    calls.length = 0;
    await watchLocation(() => undefined, () => undefined, "run.recording.u1");
    const order = calls.map((c) => `${c.plugin}.${c.method}`);
    expect(order.indexOf("RunJournal.ensurePermission")).toBeLessThan(order.indexOf("BackgroundGeolocation.addWatcher"));
  });
});

describe("navigation started by native code", () => {
  it("goes through the page's router when it listens, and falls back to a page load otherwise", async () => {
    const { navigateInApp, NAVIGATE_EVENT } = await import("@/lib/in-app-navigation");
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      const routed: string[] = [];
      const listener = (e: Event) => {
        e.preventDefault();
        routed.push((e as CustomEvent<string>).detail);
      };
      window.addEventListener(NAVIGATE_EVENT, listener);
      navigateInApp("/progress/sleep/checkin");
      window.removeEventListener(NAVIGATE_EVENT, listener);
      expect(routed).toEqual(["/progress/sleep/checkin"]);
      expect(assign).not.toHaveBeenCalled();
      navigateInApp("/train");
      expect(assign).toHaveBeenCalledWith("/train");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("deletion is confirmed by the phone; an unconfirmed one is remembered and finished at the next app start", async () => {
    const fj = await import("@/lib/run/fix-journal");
    // Confirmed straight away: nothing left pending.
    expect(await fj.clearRunJournalData("u1")).toBe(true);
    expect(localStorage.getItem("ngf.runjournal.pendingClear")).toBeNull();
    // The phone couldn't delete it (or the reply never came): remembered.
    clearAnswer = { cleared: false };
    expect(await fj.clearRunJournalData("u2")).toBe(false);
    expect(JSON.parse(localStorage.getItem("ngf.runjournal.pendingClear")!)).toEqual(["run.recording.u2"]);
    // An older app build that answers nothing counts as unconfirmed too.
    clearAnswer = undefined;
    expect(await fj.clearRunJournalData()).toBe(false);
    expect(JSON.parse(localStorage.getItem("ngf.runjournal.pendingClear")!)).toEqual(["run.recording.u2", "*"]);
    // Next app start: deleting everything covers both requests; once confirmed, nothing is pending.
    clearAnswer = { cleared: true };
    calls.length = 0;
    expect(await fj.retryPendingNativeClears()).toBe(true);
    expect(calls.filter((c) => c.method === "clear")).toEqual([{ plugin: "RunJournal", method: "clear", args: {} }]);
    expect(localStorage.getItem("ngf.runjournal.pendingClear")).toBeNull();
  });

  it("a deletion cut short by leaving the page (sign-out navigates away) is still finished at the next start", async () => {
    let answer: (v: unknown) => void = () => undefined;
    clearAnswer = new Promise((r) => (answer = r)); // the phone never answers before the page goes
    const { clearAllDrafts } = await import("@/lib/drafts");
    clearAllDrafts("u5");
    await flush();
    expect(JSON.parse(localStorage.getItem("ngf.runjournal.pendingClear")!)).toEqual(["run.recording.u5"]);
    // New page, fresh modules (the old promise is gone with the old page).
    answer({ cleared: false });
    vi.resetModules();
    clearAnswer = { cleared: true };
    calls.length = 0;
    const { retryPendingNativeClears } = await import("@/lib/run/fix-journal");
    expect(await retryPendingNativeClears()).toBe(true);
    expect(calls).toContainEqual({ plugin: "RunJournal", method: "clear", args: { key: "run.recording.u5" } });
    expect(localStorage.getItem("ngf.runjournal.pendingClear")).toBeNull();
  });

  it("discarding a recording asks for a confirmed deletion of its native journal", async () => {
    const { clearNativeConfirmed } = await import("@/lib/run/fix-journal");
    clearAnswer = { cleared: false };
    expect(await clearNativeConfirmed("run.recording.u7")).toBe(false);
    expect(JSON.parse(localStorage.getItem("ngf.runjournal.pendingClear")!)).toEqual(["run.recording.u7"]);
    clearAnswer = { cleared: true };
    expect(await clearNativeConfirmed("run.recording.u7")).toBe(true);
    expect(localStorage.getItem("ngf.runjournal.pendingClear")).toBeNull();
  });

  it("in a browser there is no native journal: deletion is trivially complete and nothing is left pending", async () => {
    native = false;
    const { clearRunJournalData } = await import("@/lib/run/fix-journal");
    expect(await clearRunJournalData("u1")).toBe(true);
    expect(localStorage.getItem("ngf.runjournal.pendingClear")).toBeNull();
  });
});

describe("recorded routes are kept out of device backups", () => {
  it("Android: backups and device transfer are off, and the native journal is in the no-backup folder", async () => {
    const { readFileSync } = await import("node:fs");
    const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    expect(manifest).toContain('android:allowBackup="false"');
    const rules = readFileSync("android/app/src/main/res/xml/data_extraction_rules.xml", "utf8");
    for (const section of ["cloud-backup", "device-transfer"]) expect(rules).toMatch(new RegExp(`<${section}[^>]*>[\\s\\S]*<exclude domain="root" />[\\s\\S]*</${section}>`));
    expect(readFileSync("android/app/src/main/java/com/narrowgatefitness/app/runjournal/RunJournalPlugin.java", "utf8")).toContain("getNoBackupFilesDir()");
  });

  it("iOS: the journal folder is marked excluded from iCloud and computer backups (checked by XCTest in CI)", async () => {
    const { readFileSync } = await import("node:fs");
    const store = readFileSync("ios/App/App/RunJournalStore.swift", "utf8");
    expect(store).toContain("values.isExcludedFromBackup = true");
    const tests = readFileSync("ios/RunJournalCore/Tests/RunJournalCoreTests/RunJournalStoreTests.swift", "utf8");
    expect(tests).toContain("testJournalFolderIsExcludedFromBackups");
  });
});
