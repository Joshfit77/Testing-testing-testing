"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { NativeSelect } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-state";
import { formatDuration, SLEEP_GOAL_MAX_MINUTES, SLEEP_GOAL_MIN_MINUTES } from "@/lib/domain/sleep";
import { setSleepGoalAction } from "@/server/actions/sleep";

const OPTIONS: number[] = [];
for (let m = SLEEP_GOAL_MIN_MINUTES; m <= SLEEP_GOAL_MAX_MINUTES; m += 15) OPTIONS.push(m);

export function SleepGoalForm({ goalMinutes }: { goalMinutes: number }) {
  const [state, action] = useActionState(setSleepGoalAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="sleep-goal" className="block text-sm font-semibold">
        Time asleep each night
      </label>
      <NativeSelect id="sleep-goal" name="goalMinutes" defaultValue={String(goalMinutes)} aria-invalid={Boolean(state.fieldErrors?.goalMinutes)} aria-describedby={state.fieldErrors?.goalMinutes ? "sleep-goal-error" : undefined}>
        {OPTIONS.map((m) => (
          <option key={m} value={m}>
            {formatDuration(m)}
          </option>
        ))}
      </NativeSelect>
      <FieldError id="sleep-goal-error" message={state.fieldErrors?.goalMinutes} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save goal</SubmitButton>
    </form>
  );
}
