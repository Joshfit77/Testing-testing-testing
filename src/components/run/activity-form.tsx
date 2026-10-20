"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { formatPace, MAX_NOTES, paceSecondsPer, parseDuration, toMeters, type ActivityKind, type DistanceUnit } from "@/lib/domain/activities";
import { cn } from "@/lib/utils";
import { createActivityAction, updateActivityAction } from "@/server/actions/activities";

export interface ActivityFormValues {
  id: string;
  kind: ActivityKind;
  source: "manual" | "treadmill";
  date: string;
  time: string;
  /** In `unit`, as typed (empty for a time-only entry). */
  distance: string;
  unit: DistanceUnit;
  duration: string;
  moving: string;
  effort: string;
  notes: string;
}

function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid gap-1 rounded-xl border border-border bg-elevated p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-highlight",
              value === o.value ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Manual and treadmill entry (create or edit). Live GPS recording is a separate flow (Stage 3). */
export function ActivityForm({ mode, initial, today }: { mode: "create" | "edit"; initial: ActivityFormValues; today: string }) {
  const router = useRouter();
  const [state, action] = useActionState(mode === "create" ? createActivityAction : updateActivityAction, initialActionState);
  const [kind, setKind] = useState<ActivityKind>(initial.kind);
  const [source, setSource] = useState(initial.source);
  const [unit, setUnit] = useState<DistanceUnit>(initial.unit);
  const [distance, setDistance] = useState(initial.distance);
  const [duration, setDuration] = useState(initial.duration);
  const [moving, setMoving] = useState(initial.moving);
  // Every field is controlled: React resets uncontrolled fields after a form action, which would
  // wipe what the user typed when the server returns a validation error.
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [effort, setEffort] = useState(initial.effort);
  const [notes, setNotes] = useState(initial.notes);
  const [handled, setHandled] = useState<number | undefined>(undefined);
  const err = state.fieldErrors ?? {};

  useEffect(() => {
    if (!state.ok || state.at === undefined || state.at === handled) return;
    setHandled(state.at);
    router.push(`/run/activities/${initial.id}`);
    router.refresh();
  }, [state, handled, router, initial.id]);

  const preview = useMemo(() => {
    const d = Number(distance);
    const total = parseDuration(duration);
    const mov = moving.trim() ? parseDuration(moving) : total;
    if (!distance.trim() || !Number.isFinite(d) || d <= 0 || mov == null || mov <= 0) return null;
    return formatPace(paceSecondsPer(toMeters(d, unit), mov, unit), unit);
  }, [distance, duration, moving, unit]);

  const fid = (n: string) => `activity-${n}`;

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="id" value={initial.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented
          name="kind"
          legend="Activity"
          value={kind}
          onChange={setKind}
          options={[
            { value: "run", label: "Run" },
            { value: "walk", label: "Walk" },
          ]}
        />
        <Segmented
          name="source"
          legend="Where"
          value={source}
          onChange={setSource}
          options={[
            { value: "manual", label: "Outdoors" },
            { value: "treadmill", label: "Treadmill" },
          ]}
        />
      </div>

      <div className="grid gap-3 min-[400px]:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={fid("date")}>Date</Label>
          <Input id={fid("date")} name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} required aria-invalid={Boolean(err.date)} />
          <FieldError message={err.date} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fid("time")}>Start time</Label>
          <Input id={fid("time")} name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required aria-invalid={Boolean(err.time)} />
          <FieldError message={err.time} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={fid("distance")}>Distance{source === "manual" ? " (optional for a time-only entry)" : ""}</Label>
        <div className="flex gap-2">
          <Input
            id={fid("distance")}
            name="distance"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            placeholder={unit === "mi" ? "e.g. 3.1" : "e.g. 5"}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            aria-invalid={Boolean(err.distance)}
            className="flex-1"
          />
          <div role="group" aria-label="Distance unit" className="flex rounded-xl border border-border bg-elevated p-1">
            {(["mi", "km"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
                className={cn("min-h-9 min-w-11 rounded-lg px-2 text-sm font-semibold", unit === u ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground")}
              >
                {u}
              </button>
            ))}
          </div>
          <input type="hidden" name="unit" value={unit} />
        </div>
        <FieldError message={err.distance} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={fid("duration")}>Duration</Label>
          <Input
            id={fid("duration")}
            name="duration"
            inputMode="numeric"
            placeholder="h:mm:ss"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-invalid={Boolean(err.duration)}
            aria-describedby={fid("duration-help")}
            required
          />
          <p id={fid("duration-help")} className="text-[11px] text-muted-foreground">
            Start to finish, e.g. 0:31:45
          </p>
          <FieldError message={err.duration} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fid("moving")}>Moving time</Label>
          <Input
            id={fid("moving")}
            name="moving"
            inputMode="numeric"
            placeholder="h:mm:ss"
            value={moving}
            onChange={(e) => setMoving(e.target.value)}
            aria-invalid={Boolean(err.moving)}
            aria-describedby={fid("moving-help")}
          />
          <p id={fid("moving-help")} className="text-[11px] text-muted-foreground">
            Optional. Without stops; pace uses this.
          </p>
          <FieldError message={err.moving} />
        </div>
      </div>

      <p className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm" aria-live="polite" data-testid="pace-preview">
        <span className="text-muted-foreground">Average moving pace: </span>
        <span className="font-semibold text-gold-highlight">{preview ?? "enter a distance and time"}</span>
      </p>

      <div className="space-y-1.5">
        <Label htmlFor={fid("effort")}>Perceived effort (optional)</Label>
        <select
          id={fid("effort")}
          name="effort"
          value={effort}
          onChange={(e) => setEffort(e.target.value)}
          className="h-11 w-full rounded-[0.625rem] border border-border bg-elevated px-3 text-base text-foreground"
          aria-invalid={Boolean(err.effort)}
        >
          <option value="">Not rated</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
              {n === 1 ? " – very easy" : n === 5 ? " – moderate" : n === 10 ? " – maximal" : ""}
            </option>
          ))}
        </select>
        <FieldError message={err.effort} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={fid("notes")}>Notes (optional)</Label>
        <textarea
          id={fid("notes")}
          name="notes"
          rows={3}
          maxLength={MAX_NOTES}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-[0.625rem] border border-border bg-elevated px-3 py-2 text-base text-foreground placeholder:text-muted-foreground"
          placeholder="How did it feel? Route, weather, shoes…"
          aria-invalid={Boolean(err.notes)}
        />
        <FieldError message={err.notes} />
      </div>

      <FormMessage state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton className="w-full sm:flex-1">{mode === "create" ? `Save ${kind}` : "Save changes"}</SubmitButton>
        {mode === "edit" && (
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
