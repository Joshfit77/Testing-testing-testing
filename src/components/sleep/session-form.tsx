"use client";

import { useActionState, useMemo, useState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-state";
import { isoToLocalInput, isValidTimeZone, type SleepSession } from "@/lib/domain/sleep";
import { saveSleepSessionAction } from "@/server/actions/sleep";

function zoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  if (!zones.includes(current)) zones = [current, ...zones];
  if (!zones.includes("UTC")) zones.push("UTC");
  return zones;
}

function deviceZone(fallback: string): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return z && isValidTimeZone(z) ? z : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Enter or edit a night or nap by hand. Bedtime and getting-up time are required; falling asleep, the final wake-up,
 * wake-ups and minutes awake are optional detail that make the estimates more accurate.
 */
export function SleepSessionForm({ session, timezone, defaults, returnTo }: { session?: SleepSession; timezone: string; defaults: { startedAt: string; endedAt: string }; returnTo?: string }) {
  const [state, action] = useActionState(saveSleepSessionAction, initialActionState);
  const id = useMemo(() => session?.id ?? crypto.randomUUID(), [session?.id]);
  const initialZone = session?.timezone ?? deviceZone(timezone);
  const [zone, setZone] = useState(initialZone);
  const zones = useMemo(() => zoneOptions(initialZone), [initialZone]);
  const local = (iso: string | null | undefined) => (iso ? isoToLocalInput(iso, session?.timezone ?? zone) : "");
  const err = (name: string) => state.fieldErrors?.[name];
  const field = "space-y-1.5";
  const label = "block text-sm font-semibold";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">What was it?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["night", "nap"] as const).map((k) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="kind" value={k} defaultChecked={(session?.kind ?? "night") === k} className="peer sr-only" />
              <span className="flex h-11 items-center justify-center rounded-xl border border-border bg-elevated text-sm font-semibold capitalize peer-checked:border-gold peer-checked:bg-gold/15 peer-checked:text-gold-highlight peer-focus-visible:ring-2 peer-focus-visible:ring-gold-highlight">
                {k === "night" ? "A night's sleep" : "A nap"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={field}>
          <label htmlFor="sleep-started" className={label}>
            Got into bed
          </label>
          <Input id="sleep-started" name="startedAt" type="datetime-local" required defaultValue={session ? local(session.startedAt) : defaults.startedAt} aria-invalid={Boolean(err("startedAt"))} aria-describedby={err("startedAt") ? "sleep-started-error" : undefined} />
          <FieldError id="sleep-started-error" message={err("startedAt")} />
        </div>
        <div className={field}>
          <label htmlFor="sleep-ended" className={label}>
            Got up
          </label>
          <Input id="sleep-ended" name="endedAt" type="datetime-local" required defaultValue={session ? local(session.endedAt) : defaults.endedAt} aria-invalid={Boolean(err("endedAt"))} aria-describedby={err("endedAt") ? "sleep-ended-error" : undefined} />
          <FieldError id="sleep-ended-error" message={err("endedAt")} />
        </div>
      </div>

      <div className={field}>
        <label htmlFor="sleep-zone" className={label}>
          Time zone
        </label>
        <NativeSelect id="sleep-zone" name="timezone" value={zone} onChange={(e) => setZone(e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">Where you slept. Travelling? Pick the zone you were in so the night lands on the right day.</p>
      </div>

      <details className="rounded-xl border border-border bg-elevated p-4" open={Boolean(session?.onsetAt || session?.finalWakeAt || session?.awakenings != null || session?.awakeMinutes != null)}>
        <summary className="cursor-pointer text-sm font-semibold">More detail (optional)</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label htmlFor="sleep-onset" className={label}>
              Fell asleep (about)
            </label>
            <Input id="sleep-onset" name="onsetAt" type="datetime-local" defaultValue={local(session?.onsetAt)} aria-invalid={Boolean(err("onsetAt"))} aria-describedby={err("onsetAt") ? "sleep-onset-error" : undefined} />
            <FieldError id="sleep-onset-error" message={err("onsetAt")} />
          </div>
          <div className={field}>
            <label htmlFor="sleep-final-wake" className={label}>
              Final wake-up
            </label>
            <Input id="sleep-final-wake" name="finalWakeAt" type="datetime-local" defaultValue={local(session?.finalWakeAt)} aria-invalid={Boolean(err("finalWakeAt"))} aria-describedby={err("finalWakeAt") ? "sleep-final-wake-error" : undefined} />
            <FieldError id="sleep-final-wake-error" message={err("finalWakeAt")} />
          </div>
          <div className={field}>
            <label htmlFor="sleep-awakenings" className={label}>
              Times you woke up
            </label>
            <Input id="sleep-awakenings" name="awakenings" type="number" inputMode="numeric" min={0} max={50} defaultValue={session?.awakenings ?? ""} aria-invalid={Boolean(err("awakenings"))} aria-describedby={err("awakenings") ? "sleep-awakenings-error" : undefined} />
            <FieldError id="sleep-awakenings-error" message={err("awakenings")} />
          </div>
          <div className={field}>
            <label htmlFor="sleep-awake-minutes" className={label}>
              Minutes awake in the night
            </label>
            <Input id="sleep-awake-minutes" name="awakeMinutes" type="number" inputMode="numeric" min={0} max={1440} defaultValue={session?.awakeMinutes ?? ""} aria-invalid={Boolean(err("awakeMinutes"))} aria-describedby={err("awakeMinutes") ? "sleep-awake-minutes-error" : undefined} />
            <FieldError id="sleep-awake-minutes-error" message={err("awakeMinutes")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">These are your own estimates. Without them, time asleep is taken as time in bed and labelled as such.</p>
      </details>

      <div className={field}>
        <label htmlFor="sleep-notes" className={label}>
          Notes
        </label>
        <Textarea id="sleep-notes" name="notes" rows={2} maxLength={280} defaultValue={session?.notes ?? ""} placeholder="Late coffee, noisy street, travel day…" />
        <FieldError id="sleep-notes-error" message={err("notes")} />
      </div>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
        {session ? "Save changes" : "Save sleep"}
      </SubmitButton>
    </form>
  );
}
