import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHECKIN_QUEUE_EVENT, flushCheckinQueue, readCheckinQueue, writeCheckinQueue, type CheckinSendResult, type PendingCheckin } from "@/lib/faith/checkin-queue";

const USER = "user-1";
const JOURNEY = "journey-1";
const reading: PendingCheckin = { journeyId: JOURNEY, activity: "reading", occurredAt: "2026-11-10T21:00:00.000Z" };
const prayer: PendingCheckin = { journeyId: JOURNEY, activity: "prayer", occurredAt: "2026-11-10T21:05:00.000Z" };

function run(results: Record<string, CheckinSendResult | Error>, journeyId: string | null | (() => Promise<string | null>) = JOURNEY) {
  const notices: { tone: string; message: string }[] = [];
  const send = vi.fn(async (activity: "reading" | "prayer") => {
    const r = results[activity]!;
    if (r instanceof Error) throw r;
    return r;
  });
  return flushCheckinQueue(USER, { journeyId, send, notify: (tone, message) => notices.push({ tone, message }) }).then((r) => ({ ...r, notices, send }));
}

/** Check-ins tapped offline: a server error must never drop one silently (that could cost the member a Day-1 restart). */
describe("offline journey check-in queue", () => {
  beforeEach(() => {
    localStorage.clear();
    writeCheckinQueue(USER, [reading, prayer]);
  });

  it("keeps a check-in queued when the server answers with a generic error, and says nothing yet", async () => {
    const r = await run({ reading: { ok: false, code: "error", error: "Couldn't save." }, prayer: { ok: true } });
    expect(readCheckinQueue(USER)).toEqual([reading]);
    expect(r.notices).toEqual([{ tone: "success", message: "Prayer you marked offline is saved." }]);
    expect(r.changed).toBe(true);
  });

  it("keeps a check-in queued when the request itself fails", async () => {
    const r = await run({ reading: "network", prayer: new Error("fetch failed") });
    expect(readCheckinQueue(USER)).toEqual([reading, prayer]);
    expect(r.notices).toEqual([]);
    expect(r.changed).toBe(false);
  });

  it("explains every refusal: too late, a closed day, no journey", async () => {
    const r = await run({ reading: { ok: false, code: "too_late", error: "The day had closed." }, prayer: { ok: false, code: "closed", error: "That day isn't open for check-ins." } });
    expect(readCheckinQueue(USER)).toEqual([]);
    expect(r.notices.map((n) => n.tone)).toEqual(["error", "error"]);
    expect(r.notices[0]!.message).toMatch(/^Your Bible reading check-in from .* reached us too late to count\. The day had closed\.$/);
    expect(r.notices[1]!.message).toMatch(/^Your prayer check-in from .* couldn't be counted\. That day isn't open for check-ins\.$/);

    writeCheckinQueue(USER, [reading]);
    const none = await run({ reading: { ok: false, code: "no_journey", error: "You don't have an active journey." } });
    expect(none.notices[0]!.message).toContain("couldn't be counted. You don't have an active journey.");
    expect(readCheckinQueue(USER)).toEqual([]);
  });

  it("tells the member when a check-in was for a journey that has ended, without sending it", async () => {
    const r = await run({}, "journey-2");
    expect(r.send).not.toHaveBeenCalled();
    expect(r.notices).toHaveLength(2);
    expect(r.notices[0]!.message).toContain("was for a journey that has since ended");
    expect(readCheckinQueue(USER)).toEqual([]);
  });

  it("looks the active journey up only when needed, and keeps everything when that lookup fails", async () => {
    const lookup = vi.fn(async () => {
      throw new Error("offline");
    });
    const r = await run({}, lookup);
    expect(r.send).not.toHaveBeenCalled();
    expect(readCheckinQueue(USER)).toEqual([reading, prayer]);

    writeCheckinQueue(USER, []);
    const idle = vi.fn(async () => JOURNEY);
    await run({}, idle);
    expect(idle).not.toHaveBeenCalled();
  });

  it("does not lose a check-in queued while a flush is running, and shares one run between callers", async () => {
    const later: PendingCheckin = { journeyId: JOURNEY, activity: "reading", occurredAt: "2026-11-11T08:00:00.000Z" };
    writeCheckinQueue(USER, [prayer]);
    const send = vi.fn(async (): Promise<CheckinSendResult> => {
      writeCheckinQueue(USER, [...readCheckinQueue(USER), later]);
      return { ok: true };
    });
    const opts = { journeyId: JOURNEY, send, notify: () => undefined };
    const [a, b] = await Promise.all([flushCheckinQueue(USER, opts), flushCheckinQueue(USER, opts)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ changed: true });
    expect(b).toEqual({ changed: true });
    expect(readCheckinQueue(USER)).toEqual([later]);
  });

  it("announces queue changes so an open check-in card can update", () => {
    const heard = vi.fn();
    window.addEventListener(CHECKIN_QUEUE_EVENT, heard);
    writeCheckinQueue(USER, []);
    window.removeEventListener(CHECKIN_QUEUE_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
