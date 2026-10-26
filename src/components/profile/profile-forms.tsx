"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/components/ui/confirm";
import { initialActionState } from "@/lib/action-state";
import { cmToFeetInches, feetInchesToCm } from "@/lib/domain/units";
import type { UnitSystem } from "@/lib/domain/types";
import { deleteAccountAction, updateProfileAction, withdrawWellnessConsentAction, setAiDataConsentAction } from "@/server/actions/profile";

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
            Faith-inspired coaching and reminders
          </p>
          <p className="text-sm text-muted-foreground">Let the AI coach and workout reminders draw on Scripture. The Faith tab is always available.</p>
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
  const confirmed = useRef(false);
  return (
    <form
      action={action}
      className="space-y-2"
      onSubmit={(e) => {
        if (confirmed.current) {
          confirmed.current = false;
          return;
        }
        e.preventDefault();
        const form = e.currentTarget;
        void confirmDialog({ title: "Withdraw consent and delete wellness data?", message: "Limitation notes and recovery check-ins are removed for good. Sleep entries stay until you delete them under Sleep & Recovery.", confirmLabel: "Withdraw", destructive: true }).then((ok) => {
          if (!ok) return;
          confirmed.current = true;
          form.requestSubmit();
        });
      }}
    >
      <SubmitButton variant="secondary" pendingLabel="Removing…">
        Withdraw consent &amp; delete wellness data
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Turn off sharing data with the AI provider (turning it on happens on the AI Coach screen, with the full list). */
export function AiConsentOffForm() {
  const [state, action] = useActionState(async () => setAiDataConsentAction(false), initialActionState);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="secondary" pendingLabel="Turning off…">
        Turn off AI Coach data sharing
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
      <div className="space-y-2">
        <Label htmlFor="delete-password">Your password</Label>
        <Input id="delete-password" name="password" type="password" autoComplete="current-password" aria-invalid={Boolean(state.fieldErrors?.password)} />
      </div>
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <p>
          This removes your workouts, runs, nutrition logs, recipes and meal plans, progress photos, AI coach conversations, prayer journal and
          everything else in your account. It can&apos;t be undone. Export your data first if you want a copy.
        </p>
        <p>A membership bought on this website is cancelled for you, with no further charges.</p>
        <p>
          If you subscribed through the App Store or Google Play, deleting your account doesn&apos;t stop those charges: cancel in your iPhone&apos;s
          Settings → your name → Subscriptions, or in Google Play → Payments &amp; subscriptions.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="destructive" pendingLabel="Deleting…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
