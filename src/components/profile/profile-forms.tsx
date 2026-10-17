"use client";

import { useActionState, useMemo, useState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { initialActionState } from "@/lib/action-state";
import { cmToFeetInches, feetInchesToCm } from "@/lib/domain/units";
import type { UnitSystem } from "@/lib/domain/types";
import { deleteAccountAction, updateProfileAction, withdrawWellnessConsentAction } from "@/server/actions/profile";

export function ProfileForm({
  initial,
}: {
  initial: { displayName: string; unitSystem: UnitSystem; heightCm: number | null; timezone: string; faithEnabled: boolean };
}) {
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  const [units, setUnits] = useState<UnitSystem>(initial.unitSystem);
  const fi = initial.heightCm ? cmToFeetInches(initial.heightCm) : { feet: 0, inches: 0 };
  const [feet, setFeet] = useState(initial.heightCm ? String(fi.feet) : "");
  const [inches, setInches] = useState(initial.heightCm ? String(fi.inches) : "");
  const [cm, setCm] = useState(initial.heightCm ? String(initial.heightCm) : "");
  const [faith, setFaith] = useState(initial.faithEnabled);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [initial.timezone];
    } catch {
      return [initial.timezone];
    }
  }, [initial.timezone]);
  const heightCm = units === "metric" ? cm : feet ? String(feetInchesToCm(Number(feet), Number(inches || 0))) : "";
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="heightCm" value={heightCm} />
      <input type="hidden" name="faithEnabled" value={faith ? "on" : ""} />
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" name="displayName" defaultValue={initial.displayName} maxLength={60} required aria-invalid={Boolean(fe.displayName)} />
        <FieldError message={fe.displayName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="unitSystem">Units</Label>
          <NativeSelect id="unitSystem" name="unitSystem" value={units} onChange={(e) => setUnits(e.target.value as UnitSystem)}>
            <option value="imperial">Imperial (lb, ft/in)</option>
            <option value="metric">Metric (kg, cm)</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Time zone</Label>
          <NativeSelect id="timezone" name="timezone" defaultValue={initial.timezone}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </NativeSelect>
          <FieldError message={fe.timezone} />
        </div>
      </div>
      {units === "imperial" ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ft">Height (ft)</Label>
            <Input id="ft" type="number" inputMode="numeric" value={feet} onChange={(e) => setFeet(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="in">Height (in)</Label>
            <Input id="in" type="number" inputMode="numeric" value={inches} onChange={(e) => setInches(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="cm">Height (cm)</Label>
          <Input id="cm" type="number" inputMode="decimal" value={cm} onChange={(e) => setCm(e.target.value)} />
        </div>
      )}
      <FieldError message={fe.heightCm} />
      <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-elevated/40 p-4">
        <div>
          <p id="faith-toggle" className="text-sm font-semibold">
            Faith &amp; Discipline section
          </p>
          <p className="text-xs text-muted-foreground">Optional Christian content: scripture, reflection journal and discipline goals.</p>
        </div>
        <Switch checked={faith} onCheckedChange={setFaith} aria-labelledby="faith-toggle" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

export function WithdrawConsentForm() {
  const [state, action] = useActionState(withdrawWellnessConsentAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="secondary" pendingLabel="Removing…">
        Withdraw consent &amp; delete wellness data
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <Label htmlFor="confirm-delete">
        Type <strong>DELETE</strong> to permanently delete your account and all of your data
      </Label>
      <Input id="confirm-delete" name="confirm" autoComplete="off" aria-invalid={Boolean(state.fieldErrors?.confirm)} />
      <FormMessage state={state} />
      <SubmitButton variant="destructive" pendingLabel="Deleting…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
