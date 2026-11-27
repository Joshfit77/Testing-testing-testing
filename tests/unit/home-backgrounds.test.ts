import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_BACKGROUNDS, HOME_BACKGROUND_PHOTOS_READY, deviceIsoDate, homeBackgroundForDate, msUntilNextLocalMidnight, weekdayOfIsoDate } from "@/lib/home-backgrounds";

describe("Home backgrounds: one for each day of the week", () => {
  it("has seven different pictures, in Date#getDay order, each with a theme", () => {
    expect(HOME_BACKGROUNDS.map((b) => b.key)).toEqual(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
    expect(new Set(HOME_BACKGROUNDS.map((b) => b.src)).size).toBe(7);
    expect(new Set(HOME_BACKGROUNDS.map((b) => b.theme)).size).toBe(7);
    // Monday to Sunday, for the owner's scenes of 2026-11-15.
    expect(HOME_BACKGROUNDS.slice(1).concat(HOME_BACKGROUNDS[0]!).map((b) => b.theme)).toEqual(["Strength", "Faith first", "Prayer", "Endurance", "Perseverance", "Rest and worship", "The cross"]);
  });

  it("no picture is shipped until the owner's photographs are approved", () => {
    if (HOME_BACKGROUND_PHOTOS_READY) return;
    for (const b of HOME_BACKGROUNDS) expect(existsSync(join(process.cwd(), "public", b.src.split("?")[0]!)), `${b.key}: a file is present but the switch is off`).toBe(false);
  });

  it.skipIf(!HOME_BACKGROUND_PHOTOS_READY)("each picture is a separate WebP file in public/, small enough for a phone", () => {
    const sums = new Set<string>();
    for (const b of HOME_BACKGROUNDS) {
      const file = join(process.cwd(), "public", b.src.split("?")[0]!);
      expect(existsSync(file), file).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
      expect(statSync(file).size).toBeLessThan(150_000);
      sums.add(bytes.toString("base64").slice(0, 4000));
    }
    expect(sums.size, "seven different files, not one picture seven times").toBe(7);
  });

  it("maps a calendar date to its weekday's picture", () => {
    expect(weekdayOfIsoDate("2026-11-09")).toBe(1); // a Monday
    expect(homeBackgroundForDate("2026-11-09").key).toBe("monday");
    expect(homeBackgroundForDate("2026-11-10").key).toBe("tuesday");
    expect(homeBackgroundForDate("2026-11-11").key).toBe("wednesday");
    expect(homeBackgroundForDate("2026-11-12").key).toBe("thursday");
    expect(homeBackgroundForDate("2026-11-13").key).toBe("friday");
    expect(homeBackgroundForDate("2026-11-14").key).toBe("saturday");
    expect(homeBackgroundForDate("2026-11-15").key).toBe("sunday");
    // Leap day, year end, and a date that is not a date.
    expect(homeBackgroundForDate("2028-02-29").key).toBe("tuesday");
    expect(homeBackgroundForDate("2026-12-31").key).toBe("thursday");
    expect(homeBackgroundForDate("not-a-date").key).toBe("sunday");
  });

  it("reads the device's own date and counts down to its next midnight", () => {
    expect(deviceIsoDate(new Date(2026, 10, 14, 23, 59, 30))).toBe("2026-11-14");
    expect(deviceIsoDate(new Date(2026, 10, 15, 0, 0, 1))).toBe("2026-11-15");
    expect(deviceIsoDate(new Date(2026, 0, 5, 9))).toBe("2026-01-05");
    // 30 s before midnight: 31 s to one second past.
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 14, 23, 59, 30))).toBe(31_000);
    // Just after midnight: nearly a whole day, never zero or negative.
    const ms = msUntilNextLocalMidnight(new Date(2026, 10, 15, 0, 0, 1));
    expect(ms).toBeGreaterThan(23 * 3_600_000);
    expect(ms).toBeLessThanOrEqual(25 * 3_600_000 + 1000);
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 14, 23, 59, 59, 999))).toBeGreaterThanOrEqual(1000);
  });

  it("the service worker stores the seven pictures only once they exist (a missing file must never stall its install)", () => {
    const sw = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
    const list = sw.match(/^const HOME_BACKGROUNDS = (.+);$/m)?.[1] ?? "";
    if (HOME_BACKGROUND_PHOTOS_READY) {
      expect(list).toContain("/home-backgrounds/${d}.webp");
      for (const b of HOME_BACKGROUNDS) expect(list).toContain(`"${b.key}"`);
    } else {
      expect(list).toBe("[]");
    }
  });
});
