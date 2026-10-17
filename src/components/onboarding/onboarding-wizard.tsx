"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Notice } from "@/components/common/states";
import { cn } from "@/lib/utils";
import { cmToFeetInches, displayWeight, feetInchesToCm, toKg } from "@/lib/domain/units";
import {
  DIETARY_PREFERENCES,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  GOAL_LABELS,
  PRIMARY_GOALS,
  PROGRAM_TYPE_LABELS,
  PROGRAM_TYPES,
  type DietaryPreference,
  type Equipment,
  type ExperienceLevel,
  type PrimaryGoal,
  type ProgramType,
  type UnitSystem,
} from "@/lib/domain/types";
import type { OnboardingInput } from "@/lib/validation/schemas";
import { saveOnboardingAction } from "@/server/actions/onboarding";

const DIET_LABELS: Record<DietaryPreference, string> = {
  no_preference: "No preference",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  dairy_free: "Dairy-free",
  gluten_free: "Gluten-free",
  halal: "Halal",
  kosher: "Kosher",
};

const EQUIPMENT_PRESETS: { label: string; items: Equipment[] }[] = [
  { label: "Full gym", items: EQUIPMENT.filter((e) => e !== "heavy_bag" && e !== "strongman_implements") as Equipment[] },
  { label: "Home gym", items: ["barbell", "rack", "bench", "dumbbell", "pull_up_bar", "band", "kettlebell"] },
  { label: "Dumbbells only", items: ["dumbbell", "bench", "band"] },
  { label: "Bodyweight only", items: ["bodyweight", "mat"] },
];

export interface OnboardingInitial extends Partial<OnboardingInput> {
  displayName?: string;
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition-colors",
        selected ? "border-gold bg-gold/12 text-gold-highlight" : "border-border bg-elevated text-foreground hover:border-gold-muted",
      )}
    >
      {selected && <Check className="size-4 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

const STEPS = ["About you", "Your goal", "Your schedule", "Preferences"] as const;

export function OnboardingWizard({ initial, mode = "create" }: { initial: OnboardingInitial; mode?: "create" | "edit" }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [rebuild, setRebuild] = useState(false);

  const [units, setUnits] = useState<UnitSystem>(initial.unitSystem ?? "imperial");
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [age, setAge] = useState(initial.age ? String(initial.age) : "");
  const initFt = initial.heightCm ? cmToFeetInches(initial.heightCm) : null;
  const [feet, setFeet] = useState(initFt ? String(initFt.feet) : "");
  const [inches, setInches] = useState(initFt ? String(initFt.inches) : "");
  const [cm, setCm] = useState(initial.heightCm ? String(initial.heightCm) : "");
  const [weight, setWeight] = useState(initial.weightKg ? String(displayWeight(initial.weightKg, initial.unitSystem ?? "imperial")) : "");
  const [goal, setGoal] = useState<PrimaryGoal | null>(initial.primaryGoal ?? null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(initial.experience ?? null);
  const [days, setDays] = useState(initial.daysPerWeek ?? 3);
  const [minutes, setMinutes] = useState(initial.sessionMinutes ?? 45);
  const [equipment, setEquipment] = useState<Equipment[]>(initial.equipment ?? ["bodyweight", "mat"]);
  const [types, setTypes] = useState<ProgramType[]>(initial.preferredTypes ?? []);
  const [diet, setDiet] = useState<DietaryPreference[]>(initial.dietaryPreferences ?? ["no_preference"]);
  const [limitations, setLimitations] = useState(initial.limitations ?? "");
  const [consent, setConsent] = useState(initial.wellnessConsent ?? false);
  const [faith, setFaith] = useState(initial.faithEnabled ?? false);

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const heightCm = (): number | null => {
    if (units === "metric") return cm ? Number(cm) : null;
    if (!feet) return null;
    return feetInchesToCm(Number(feet), Number(inches || 0));
  };

  const switchUnits = (next: UnitSystem) => {
    if (next === units) return;
    const h = heightCm();
    const w = weight ? toKg(Number(weight), units) : null;
    setUnits(next);
    if (h) {
      if (next === "metric") setCm(String(Math.round(h)));
      else {
        const fi = cmToFeetInches(h);
        setFeet(String(fi.feet));
        setInches(String(fi.inches));
      }
    }
    if (w) setWeight(String(displayWeight(w, next)));
  };

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!displayName.trim()) return "Please enter your name.";
      const a = Number(age);
      if (!age || !Number.isFinite(a)) return "Please enter your age.";
      if (a < 18) return "Narrow Gate Fitness is available to adults (18+) at launch.";
      const h = heightCm();
      if (!h || h < 90 || h > 260) return "Please enter a valid height.";
      const w = weight ? toKg(Number(weight), units) : 0;
      if (!w || w < 25 || w > 400) return "Please enter a valid weight.";
    }
    if (step === 1 && (!goal || !experience)) return "Choose a primary goal and your experience level.";
    if (step === 3 && limitations.trim() && !consent) return "To save limitation notes, please give consent — or clear the field.";
    return null;
  };

  const next = () => {
    const msg = validateStep();
    setError(msg);
    if (!msg) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = () => {
    const msg = validateStep();
    setError(msg);
    if (msg) return;
    const payload: OnboardingInput & { rebuildProgram?: boolean } = {
      displayName: displayName.trim(),
      age: Number(age),
      unitSystem: units,
      heightCm: Math.round((heightCm() ?? 0) * 10) / 10,
      weightKg: toKg(Number(weight), units),
      primaryGoal: goal!,
      experience: experience!,
      daysPerWeek: days,
      sessionMinutes: minutes,
      equipment: [...new Set(equipment)],
      preferredTypes: types,
      limitations: limitations.trim(),
      wellnessConsent: consent,
      dietaryPreferences: diet.length ? diet : ["no_preference"],
      faithEnabled: faith,
      rebuildProgram: mode === "create" ? true : rebuild,
    };
    setSuccess(null);
    startTransition(async () => {
      const res = await saveOnboardingAction(payload);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        setFieldErrors(res.fieldErrors ?? {});
      } else {
        setFieldErrors({});
        setSuccess(res.message ?? "Saved.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-gold">{STEPS[step]}</span>
        </div>
        <ProgressBar value={((step + 1) / STEPS.length) * 100} label="Onboarding progress" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
        {step === 0 && (
          <fieldset className="space-y-5">
            <legend className="font-display text-2xl font-bold uppercase">About you</legend>
            <div className="space-y-2">
              <Label htmlFor="ob-name">Name</Label>
              <Input id="ob-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} autoComplete="given-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-age">Age</Label>
              <Input id="ob-age" type="number" inputMode="numeric" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
              <p className="text-xs text-muted-foreground">Used only to confirm you&apos;re an adult and tailor recommendations.</p>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Units</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Units">
                <Chip selected={units === "imperial"} onClick={() => switchUnits("imperial")}>
                  Imperial (lb, ft)
                </Chip>
                <Chip selected={units === "metric"} onClick={() => switchUnits("metric")}>
                  Metric (kg, cm)
                </Chip>
              </div>
            </div>
            {units === "imperial" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ob-ft">Height (ft)</Label>
                  <Input id="ob-ft" type="number" inputMode="numeric" min={3} max={8} value={feet} onChange={(e) => setFeet(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-in">Height (in)</Label>
                  <Input id="ob-in" type="number" inputMode="numeric" min={0} max={11} value={inches} onChange={(e) => setInches(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="ob-cm">Height (cm)</Label>
                <Input id="ob-cm" type="number" inputMode="decimal" min={90} max={260} value={cm} onChange={(e) => setCm(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ob-weight">Bodyweight ({units === "imperial" ? "lb" : "kg"})</Label>
              <Input id="ob-weight" type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="font-display text-2xl font-bold uppercase">Primary goal</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRIMARY_GOALS.map((g) => (
                  <Chip key={g} selected={goal === g} onClick={() => setGoal(g)}>
                    {GOAL_LABELS[g]}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="font-display text-xl font-bold uppercase">Training experience</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXPERIENCE_LEVELS.map((x) => (
                  <Chip key={x} selected={experience === x} onClick={() => setExperience(x)}>
                    {EXPERIENCE_LABELS[x]}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="font-display text-2xl font-bold uppercase">Your schedule</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ob-days">Days per week</Label>
                  <NativeSelect id="ob-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d} {d === 1 ? "day" : "days"}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-min">Session length</Label>
                  <NativeSelect id="ob-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                    {[20, 30, 45, 60, 75, 90].map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="font-display text-xl font-bold uppercase">Available equipment</legend>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_PRESETS.map((p) => (
                  <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => setEquipment(p.items)}>
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {EQUIPMENT.map((e) => (
                  <Chip key={e} selected={equipment.includes(e)} onClick={() => toggle(equipment, e, setEquipment)}>
                    {EQUIPMENT_LABELS[e]}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="font-display text-2xl font-bold uppercase">Training styles you enjoy</legend>
              <p className="text-sm text-muted-foreground">Optional — choose any that interest you.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PROGRAM_TYPES.map((t) => (
                  <Chip key={t} selected={types.includes(t)} onClick={() => toggle(types, t, setTypes)}>
                    {PROGRAM_TYPE_LABELS[t]}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="font-display text-xl font-bold uppercase">Dietary preferences</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DIETARY_PREFERENCES.map((d) => (
                  <Chip
                    key={d}
                    selected={diet.includes(d)}
                    onClick={() =>
                      d === "no_preference" ? setDiet(["no_preference"]) : toggle(diet.filter((x) => x !== "no_preference"), d, setDiet)
                    }
                  >
                    {DIET_LABELS[d]}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-3 rounded-xl border border-border bg-elevated/40 p-4">
              <legend className="px-1 text-sm font-semibold">Physical limitations (optional)</legend>
              <p className="text-xs text-muted-foreground">
                Note anything you want your training to work around (e.g. &ldquo;prefer to avoid overhead pressing&rdquo;). This is
                sensitive wellness information — we only store it with your consent, and it&apos;s never visible to administrators. This
                app doesn&apos;t diagnose or treat injuries.
              </p>
              <Textarea value={limitations} onChange={(e) => setLimitations(e.target.value)} maxLength={1000} aria-label="Physical limitations" aria-invalid={Boolean(fieldErrors.limitations)} />
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 accent-[#C9A54C]" />
                <span>I consent to Narrow Gate Fitness storing this optional wellness information to personalize my training.</span>
              </label>
            </fieldset>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-elevated/40 p-4">
              <div>
                <p id="faith-label" className="text-sm font-semibold">
                  Show the optional Faith &amp; Discipline section
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Scripture, reflection journal and discipline goals from a Christian perspective. Entirely optional and never required for
                  workouts. You can change this any time.
                </p>
              </div>
              <Switch checked={faith} onCheckedChange={setFaith} aria-labelledby="faith-label" />
            </div>
            {mode === "edit" && (
              <label className="flex items-start gap-3 rounded-xl border border-gold-muted/50 bg-gold/5 p-4 text-sm">
                <input type="checkbox" checked={rebuild} onChange={(e) => setRebuild(e.target.checked)} className="mt-0.5 size-5 accent-[#C9A54C]" />
                <span>Rebuild my starter program from these answers and make it my active program.</span>
              </label>
            )}
          </div>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {mode === "create" ? (pending ? "Building your plan…" : "Build my plan") : pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </div>
    </div>
  );
}

