import { beforeEach, describe, expect, it, vi } from "vitest";

/** O-03: a native GPS watcher whose page was reloaded is found and stopped; the page's own watchers are left alone. */
const added: string[] = [];
const removed: string[] = [];
let next = 0;
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true, getPlatform: () => "ios" },
  registerPlugin: () => ({
    addWatcher: async () => {
      const id = `w${++next}`;
      added.push(id);
      return id;
    },
    removeWatcher: async ({ id }: { id: string }) => void removed.push(id),
    openSettings: async () => undefined,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  added.length = 0;
  removed.length = 0;
  vi.resetModules();
});

describe("orphaned native GPS watchers", () => {
  it("a watcher from before a reload is removed; the running one is kept until its own stop", async () => {
    // Page 1 starts a watcher, then the web view reloads (the page's handle is gone, the native watcher isn't).
    const page1 = await import("@/lib/native/location");
    await page1.watchLocation(() => undefined, () => undefined);
    expect(JSON.parse(localStorage.getItem("native.gps.watchers")!)).toEqual(["w1"]);

    vi.resetModules();
    const page2 = await import("@/lib/native/location");
    expect(await page2.removeOrphanedWatchers()).toBe(1);
    expect(removed).toEqual(["w1"]);

    // Page 2's own watcher survives a cleanup, and its stop removes it and forgets it.
    const stop = await page2.watchLocation(() => undefined, () => undefined);
    expect(await page2.removeOrphanedWatchers()).toBe(0);
    expect(removed).toEqual(["w1"]);
    stop();
    expect(removed).toEqual(["w1", "w2"]);
    expect(localStorage.getItem("native.gps.watchers")).toBeNull();
  });
});
