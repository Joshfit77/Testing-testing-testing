"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-state";
import { DISTURBANCE_LABELS, DISTURBANCES, EXERCISE_TIMING_LABELS, EXERCISE_TIMINGS, RATING_LABELS, type RatingField, type SleepCheckin } from "@/lib/domain/sleep-checkins";
import { saveSleepCheckinAction } from "@/server/actions/sleep-checkins";

function Rating({ name, value }: { name: RatingField; value: number | null }) {
  const r = RATING_LABELS[name];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{r.label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} defaultChecked={value === n} className="peer sr-only" />
            {n === 1 ? <span className="sr-only">({r.low}) </span> : n === 5 ? <span className="sr-only">({r.high}) </span> : null}
            <span className="flex h-11 items-center justify-center rounded-xl border border-border bg-elevated text-sm font-semibold peer-checked:border-gold peer-checked:bg-gold/15 peer-checked:text-gold-highlight peer-focus-visible:ring-2 peer-focus-visible:ring-gold-highlight">
              {n}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
        <span>{r.low}</span>
        <span>{r.high}</span>
      </div>
    </fieldset>
  );
}

function YesNo({ name, label, value }: { name: string; label: string; value: boolean | null }) {
  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="float-left text-sm font-semibold">{label}</legend>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((v) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name={name} value={v} defaultChecked={value === (v === "yes")} className="peer sr-only" />
            <span className="flex h-10 min-w-14 items-center justify-center rounded-xl border border-border bg-elevated px-3 text-sm font-semibold capitalize peer-checked:border-gold peer-checked:bg-gold/15 peer-checked:text-gold-highlight peer-focus-visible:ring-2 peer-focus-visible:ring-gold-highlight">
              {v}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The full check-in for one day. Everything is optional: answer what you like and skip the rest. */
export function SleepCheckinForm({ day, checkin, returnTo }: { day: string; checkin: SleepCheckin | null; returnTo?: string }) {
  const [state, action] = useActionState(saveSleepCheckinAction, initialActionState);
  const err = (name: string) => state.fieldErrors?.[name];
  const section = "rounded-2xl border border-border bg-card p-5 space-y-5";
  const h = "font-display text-lg font-bold uppercase";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="day" value={day} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <section className={section} aria-labelledby="ci-morning">
        <h2 id="ci-morning" className={h}>
          This morning
        </h2>
        <Rating name="restedness" value={checkin?.restedness ?? null} />
        <Rating name="sleep_quality" value={checkin?.sleep_quality ?? null} />
      </section>

      <section className={section} aria-labelledby="ci-day">
        <h2 id="ci-day" className={h}>
          Through the day
        </h2>
        <p className="-mt-3 text-xs text-muted-foreground">Come back later to fill these in, or skip them.</p>
        <Rating name="energy_morning" value={checkin?.energy_morning ?? null} />
        <Rating name="energy_afternoon" value={checkin?.energy_afternoon ?? null} />
        <Rating name="energy_evening" value={checkin?.energy_evening ?? null} />
        <Rating name="mood" value={checkin?.mood ?? null} />
        <Rating name="stress" value={checkin?.stress ?? null} />
      </section>

      <section className={section} aria-labelledby="ci-evening">
        <h2 id="ci-evening" className={h}>
          The evening before
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="ci-caffeine" className="block text-sm font-semibold">
            Last caffeine (time)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Input id="ci-caffeine" name="caffeine_last" type="time" defaultValue={checkin?.caffeine_last ?? ""} className="max-w-40" aria-invalid={Boolean(err("caffeine_last"))} aria-describedby={err("caffeine_last") ? "ci-caffeine-error" : undefined} />
            <label className="flex items-center gap-2 text-sm min-h-11 items-center">
              <input type="checkbox" name="caffeine_none" className="size-5 accent-gold" /> None that day
            </label>
          </div>
          <FieldError id="ci-caffeine-error" message={err("caffeine_last")} />
        </div>
        <YesNo name="alcohol" label="Alcohol" value={checkin?.alcohol ?? null} />
        <YesNo name="late_meal" label="A large meal within 2 hours of bed" value={checkin?.late_meal ?? null} />
        <YesNo name="evening_screens" label="Screens in the last hour before bed" value={checkin?.evening_screens ?? null} />
        <div className="space-y-1.5">
          <label htmlFor="ci-exercise" className="block text-sm font-semibold">
            Training that day
          </label>
          <NativeSelect id="ci-exercise" name="exercise_timing" defaultValue={checkin?.exercise_timing ?? ""}>
            <option value="">Not answered</option>
            {EXERCISE_TIMINGS.map((t) => (
              <option key={t} value={t}>
                {EXERCISE_TIMING_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <YesNo name="travel" label="Travelling or off your usual schedule" value={checkin?.travel ?? null} />
      </section>

      <section className={section} aria-labelledby="ci-night">
        <h2 id="ci-night" className={h}>
          During the night
        </h2>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Anything that disturbed you</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DISTURBANCES.map((d) => (
              <label key={d} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-elevated px-3 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold/15">
                <input type="checkbox" name="disturbances" value={d} defaultChecked={checkin?.disturbances.includes(d) ?? false} className="size-4 accent-gold" />
                {DISTURBANCE_LABELS[d]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor="ci-aid" className="block text-sm font-semibold">
            Sleep aid, if you used one (optional)
          </label>
          <Input id="ci-aid" name="sleep_aid" maxLength={120} defaultValue={checkin?.sleep_aid ?? ""} placeholder="What you took, in your own words" aria-invalid={Boolean(err("sleep_aid"))} aria-describedby={err("sleep_aid") ? "ci-aid-error" : undefined} />
          <FieldError id="ci-aid-error" message={err("sleep_aid")} />
          <p className="text-xs text-muted-foreground">For your own record only. The app never suggests or adjusts medication.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ci-notes" className="block text-sm font-semibold">
            Notes
          </label>
          <Textarea id="ci-notes" name="notes" rows={2} maxLength={280} defaultValue={checkin?.notes ?? ""} />
          <FieldError id="ci-notes-error" message={err("notes")} />
        </div>
      </section>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
        Save check-in
      </SubmitButton>
    </form>
  );
}
