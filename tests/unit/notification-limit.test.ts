// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ALL_ALARM_IDS } from "@/lib/domain/sleep-alarm";
import { PENDING_BUDGET } from "@/lib/notifications/planner";
import { ALL_APP_REMINDER_IDS } from "@/lib/notifications/catalog";
import { ALL_FAITH_REMINDER_IDS } from "@/lib/faith-reminders";

/**
 * iOS keeps only the 64 pending notifications that fire soonest per app and silently drops the rest. Everything the
 * app can have pending at once must fit: reminders (the planner's budget), every alarm id, and the rest timer.
 */
describe("pending notification limit", () => {
  it("reminders + alarm (weekly, and the snooze / follow-up slot) + rest timer fit in 64", () => {
    const REST_TIMER = 1;
    expect(PENDING_BUDGET + ALL_ALARM_IDS.length + REST_TIMER).toBeLessThanOrEqual(64);
  });

  it("alarm ids never collide with reminder ids", () => {
    const reminders = new Set([...ALL_APP_REMINDER_IDS, ...ALL_FAITH_REMINDER_IDS]);
    expect(ALL_ALARM_IDS.filter((id) => reminders.has(id))).toEqual([]);
  });
});
