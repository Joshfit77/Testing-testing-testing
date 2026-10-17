"use client";

import { useActionState, useState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import type { UnitSystem } from "@/lib/domain/types";
import { lengthUnit, weightUnit } from "@/lib/domain/units";
import { createGoalAction, logMeasurementAction, logWeightAction } from "@/server/actions/progress";

export function WeightForm({ units, today }: { units: UnitSystem; today: string }) {
  const [state, action] = useActionState(logWeightAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="w-weight">Weight ({weightUnit(units)})</Label>
          <Input id="w-weight" name="weight" type="number" inputMode="decimal" step="0.1" required aria-invalid={Boolean(state.fieldErrors?.weight)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="w-date">Date</Label>
          <Input id="w-date" name="recordedOn" type="date" defaultValue={today} max={today} required />
        </div>
      </div>
      <FieldError message={state.fieldErrors?.weight} />
      <FormMessage state={state} />
      <SubmitButton className="w-full">Save weight</SubmitButton>
    </form>
  );
}

export function MeasurementForm({ units, today }: { units: UnitSystem; today: string }) {
  const [state, action] = useActionState(logMeasurementAction, initialActionState);
  const u = lengthUnit(units);
  const fields = [
    ["waist", `Waist (${u})`],
    ["chest", `Chest (${u})`],
    ["hips", `Hips (${u})`],
    ["arm", `Arm (${u})`],
    ["thigh", `Thigh (${u})`],
    ["bodyFatPct", "Body fat (%)"],
  ] as const;
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="m-date">Date</Label>
        <Input id="m-date" name="recordedOn" type="date" defaultValue={today} max={today} required />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fields.map(([name, label]) => (
          <div key={name} className="space-y-1">
            <Label htmlFor={`m-${name}`} className="text-xs">
              {label}
            </Label>
            <Input id={`m-${name}`} name={name} type="number" inputMode="decimal" step="0.1" aria-invalid={Boolean(state.fieldErrors?.[name])} />
          </div>
        ))}
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="w-full">
        Save measurements
      </SubmitButton>
    </form>
  );
}

export function GoalForm({ exercises, units }: { exercises: { id: string; name: string }[]; units: UnitSystem }) {
  const [state, action] = useActionState(createGoalAction, initialActionState);
  const [type, setType] = useState("bodyweight");
  const unitDefault = type === "bodyweight" || type === "strength" ? weightUnit(units) : type === "frequency" ? "workouts/week" : "";
  return (
    <form action={action} className="space-y-3" key={state.at}>
      <div className="space-y-2">
        <Label htmlFor="g-title">Goal</Label>
        <Input id="g-title" name="title" required maxLength={120} placeholder="e.g. Squat 1.5× bodyweight" aria-invalid={Boolean(state.fieldErrors?.title)} />
        <FieldError message={state.fieldErrors?.title} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="g-type">Type</Label>
          <NativeSelect id="g-type" name="goalType" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="bodyweight">Bodyweight</option>
            <option value="strength">Strength (est. 1RM)</option>
            <option value="frequency">Workouts per week</option>
            <option value="custom">Custom</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-date">Target date</Label>
          <Input id="g-date" name="targetDate" type="date" />
        </div>
      </div>
      {type === "strength" && (
        <div className="space-y-2">
          <Label htmlFor="g-ex">Exercise</Label>
          <NativeSelect id="g-ex" name="exerciseId" required>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {type !== "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="g-target">Target</Label>
            <Input id="g-target" name="targetValue" type="number" inputMode="decimal" step="0.1" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-unit">Unit</Label>
            <Input id="g-unit" name="unit" defaultValue={unitDefault} key={unitDefault} readOnly={type !== "custom"} />
          </div>
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="w-full">
        Add goal
      </SubmitButton>
    </form>
  );
}
