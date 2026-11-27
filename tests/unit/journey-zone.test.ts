import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { journeyZoneAt } = await import("@/server/services/journeys");

const base = { timezone: "America/Chicago", previous_timezone: null, timezone_since: null, pending_timezone: null, timezone_switch_at: null };

describe("journeyZoneAt (the same rule as public.faith_journey_zone_at)", () => {
  it("is the journey's own zone, whatever the profile says", () => {
    expect(journeyZoneAt(base, new Date("2026-06-01T12:00:00Z"), "Asia/Tokyo")).toBe("America/Chicago");
  });
  it("a requested change applies only from its switch moment", () => {
    const row = { ...base, pending_timezone: "Europe/Berlin", timezone_switch_at: "2026-06-04T05:00:00Z" };
    expect(journeyZoneAt(row, new Date("2026-06-04T04:59:59Z"))).toBe("America/Chicago");
    expect(journeyZoneAt(row, new Date("2026-06-04T05:00:00Z"))).toBe("Europe/Berlin");
  });
  it("after a change, earlier moments keep the previous zone", () => {
    const row = { ...base, timezone: "Europe/Berlin", previous_timezone: "America/Chicago", timezone_since: "2026-06-04T05:00:00Z" };
    expect(journeyZoneAt(row, new Date("2026-06-03T12:00:00Z"))).toBe("America/Chicago");
    expect(journeyZoneAt(row, new Date("2026-06-05T12:00:00Z"))).toBe("Europe/Berlin");
  });
  it("a journey from before the change (no zone stored yet) uses the fallback", () => {
    expect(journeyZoneAt({ ...base, timezone: null }, new Date(), "UTC")).toBe("UTC");
  });
});
