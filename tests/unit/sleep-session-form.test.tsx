import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * "Enter sleep by hand" is server-rendered on a host whose clock zone is UTC, then hydrated on the member's phone in
 * their own zone. The zone picker used to read the device's zone during render, so the option list differed between
 * the two and React threw a hydration error (#418) on every visit outside UTC.
 */
vi.mock("@/server/actions/sleep", () => ({ saveSleepSessionAction: vi.fn() }));
const { SleepSessionForm } = await import("@/components/sleep/session-form");

const ZONES = ["Africa/Abidjan", "America/Chicago", "America/New_York", "Europe/London"];

function onDevice(tz: string) {
  vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => [...ZONES]);
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...real.call(this), timeZone: tz };
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("entering sleep by hand", () => {
  it("hydrates without a mismatch when the server and the phone are in different zones, then uses the phone's zone", async () => {
    const element = <SleepSessionForm timezone="America/Chicago" defaults={{ startedAt: "2026-10-30T22:30", endedAt: "2026-10-31T06:30" }} />;
    onDevice("UTC");
    const html = renderToString(element);
    vi.restoreAllMocks();

    onDevice("America/New_York");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, element, { onRecoverableError: (e) => errors.push(e) });
    });
    expect(errors).toEqual([]);
    const select = container.querySelector<HTMLSelectElement>("#sleep-zone")!;
    expect(select.value).toBe("America/New_York");
    expect([...select.options].map((o) => o.value)).toEqual([...ZONES, "UTC"]);
  });

  it("keeps the zone a night was recorded in when editing it", async () => {
    onDevice("America/New_York");
    const container = document.createElement("div");
    document.body.append(container);
    const session = { id: "5f1c6a52-1b2c-4d3e-8f90-123456789abc", kind: "night" as const, source: "manual" as const, nightOf: "2026-10-31", timezone: "Europe/London", startedAt: "2026-10-30T22:00:00Z", endedAt: "2026-10-31T06:00:00Z", onsetAt: null, finalWakeAt: null, awakeMinutes: null, awakenings: null };
    const { createRoot } = await import("react-dom/client");
    await act(async () => {
      createRoot(container).render(<SleepSessionForm session={session} timezone="America/Chicago" defaults={{ startedAt: "", endedAt: "" }} />);
    });
    expect(container.querySelector<HTMLSelectElement>("#sleep-zone")!.value).toBe("Europe/London");
    expect(container.querySelector<HTMLInputElement>("#sleep-started")!.value).toBe("2026-10-30T22:00");
  });

  it("switches a new entry to nap-sized times when A nap is chosen, and back for a night", async () => {
    onDevice("UTC");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T14:07:00Z"));
    try {
      const container = document.createElement("div");
      document.body.append(container);
      const { createRoot } = await import("react-dom/client");
      const defaults = { startedAt: "2026-10-30T22:30", endedAt: "2026-10-31T06:30" };
      await act(async () => {
        createRoot(container).render(<SleepSessionForm timezone="UTC" defaults={defaults} />);
      });
      const start = container.querySelector<HTMLInputElement>("#sleep-started")!;
      const end = container.querySelector<HTMLInputElement>("#sleep-ended")!;
      const radio = (k: string) => container.querySelector<HTMLInputElement>(`input[name="kind"][value="${k}"]`)!;
      await act(async () => radio("nap").click());
      expect([start.value, end.value]).toEqual(["2026-10-31T13:35", "2026-10-31T14:05"]);
      await act(async () => radio("night").click());
      expect([start.value, end.value]).toEqual([defaults.startedAt, defaults.endedAt]);
      // The time zone is under More detail, with a one-line reminder of it next to the times.
      expect(container.querySelector("details #sleep-zone")).not.toBeNull();
      expect(container.textContent).toContain("Times are in UTC.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves times the member typed alone when the kind changes", async () => {
    onDevice("UTC");
    const container = document.createElement("div");
    document.body.append(container);
    const { createRoot } = await import("react-dom/client");
    await act(async () => {
      createRoot(container).render(<SleepSessionForm timezone="UTC" defaults={{ startedAt: "2026-10-30T22:30", endedAt: "2026-10-31T06:30" }} />);
    });
    const start = container.querySelector<HTMLInputElement>("#sleep-started")!;
    await act(async () => {
      start.value = "2026-10-31T13:00";
      start.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLInputElement>('input[name="kind"][value="nap"]')!.click());
    expect(start.value).toBe("2026-10-31T13:00");
  });
});
