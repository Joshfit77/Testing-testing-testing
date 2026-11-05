import { afterEach, describe, expect, it, vi } from "vitest";
import { initialTimeZoneOptions, timeZoneOptions } from "@/lib/time-zone-options";

describe("time zone options", () => {
  afterEach(() => vi.restoreAllMocks());

  it("always includes the member's own zone and UTC, which an engine's list can lack", () => {
    // Node's list has no "UTC" (the database default) and may use old names (Europe/Kiev, not Europe/Kyiv).
    vi.spyOn(Intl as unknown as { supportedValuesOf: (k: string) => string[] }, "supportedValuesOf").mockReturnValue(["Africa/Abidjan", "Europe/Kiev"]);
    expect(timeZoneOptions("UTC")).toEqual(["UTC", "Africa/Abidjan", "Europe/Kiev"]);
    expect(timeZoneOptions("Europe/Kyiv")).toEqual(["Europe/Kyiv", "Africa/Abidjan", "Europe/Kiev", "UTC"]);
    expect(timeZoneOptions("Europe/Kiev")).toEqual(["Africa/Abidjan", "Europe/Kiev", "UTC"]);
  });

  it("falls back to the member's zone and UTC when the engine can't list zones", () => {
    vi.spyOn(Intl as unknown as { supportedValuesOf: (k: string) => string[] }, "supportedValuesOf").mockImplementation(() => {
      throw new RangeError("unsupported");
    });
    expect(timeZoneOptions("America/Chicago")).toEqual(["America/Chicago", "UTC"]);
  });

  it("the first render's list doesn't depend on the engine at all (server and Safari agree)", () => {
    const spy = vi.spyOn(Intl as unknown as { supportedValuesOf: (k: string) => string[] }, "supportedValuesOf");
    expect(initialTimeZoneOptions("America/Chicago")).toEqual(["America/Chicago", "UTC"]);
    expect(initialTimeZoneOptions("UTC")).toEqual(["UTC"]);
    expect(spy).not.toHaveBeenCalled();
  });
});
