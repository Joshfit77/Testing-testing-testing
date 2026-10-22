"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Notice } from "@/components/common/states";
import { cn } from "@/lib/utils";
import { cmToFeetInches, displayWeight, feetInchesToCm, toKg, weightUnit } from "@/lib/domain/units";
import {
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  GOAL_LABELS,
  PRIMARY_GOALS,
  SECONDARY_GOAL_LABELS,
  SECONDARY_GOALS,
  type ExperienceLevel,
  type PrimaryGoal,
  type SecondaryGoal,
  type UnitSystem,
} from "@/lib/domain/types";
import { applyDisplayPrefs, type TextSize } from "@/components/shell/app-shell";
import {
  ACTIVITY_INFO,
  ACTIVITY_LEVELS,
  defaultWeeklyRate,
  rateTowardGoal,
  WEEKLY_RATES_KG,
  type ActivityLevel,
  type WeeklyRateKg,
} from "@/lib/domain/calorie-budget";
import { SESSION_MINUTES } from "@/lib/domain/starter-program";
import { EQUIPMENT_PRESETS } from "@/lib/domain/equipment-presets";
import { bmi, paceLabel, paceOptions } from "@/lib/domain/diary";
import { DIET_TYPES, DIETS, type DietType } from "@/lib/domain/diets";
import type { Sex } from "@/lib/domain/nutrition";
import { completeOnboardingAction } from "@/server/actions/onboarding";

/** Goals where a target bodyweight matters; for the rest the goal-weight question starts hidden. */
const WEIGHT_GOALS: PrimaryGoal[] = ["lose_fat", "build_muscle", "general_health"];

const STEPS = [
  { id: "goal", title: "Main goal" },
  { id: "second", title: "Second goal (optional)" },
  { id: "sex", title: "Sex" },
  { id: "age", title: "Age" },
  { id: "height", title: "Height" },
  { id: "weight", title: "Current weight" },
  { id: "target", title: "Weight goal" },
  { id: "activity", title: "Daily activity" },
  { id: "experience", title: "Experience" },
  { id: "schedule", title: "Schedule" },
  { id: "equipment", title: "Equipment" },
  { id: "diet", title: "Diet style" },
  { id: "comfort", title: "Display (optional)" },
  { id: "finish", title: "Last step" },
] as const;
type StepId = (typeof STEPS)[number]["id"];
/** Steps that can be skipped without an answer. */
const OPTIONAL_STEPS: readonly StepId[] = ["second", "comfort"];

const TEXT_SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: "default", label: "Default", sample: "text-base" },
  { value: "large", label: "Large", sample: "text-lg" },
  { value: "xlarge", label: "Extra large", sample: "text-xl" },
];

function Choice({
  selected,
  onClick,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors",
        selected ? "border-gold bg-gold/12" : "border-border bg-elevated hover:border-gold-muted",
      )}
    >
      <span className={cn("flex items-center gap-2 text-sm font-semibold", selected && "text-gold-highlight")}>
        {selected && <Check className="size-4 shrink-0" aria-hidden />}
        {title}
        {badge && <span className="rounded-full border border-gold-muted px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-gold">{badge}</span>}
      </span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </button>
  );
}

function Question({ title, help, children }: { title: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="font-display text-2xl font-bold uppercase leading-tight md:text-3xl">{title}</legend>
      {help && <p className="text-sm text-muted-foreground">{help}</p>}
      {children}
    </fieldset>
  );
}

/**
 * The guided sign-up questionnaire: one question per screen with a progress bar and Back/Continue.
 * Answers stay in client state; one server action at the end saves everything and builds the plan.
 */
export function OnboardingQuestionnaire({ initialName }: { initialName: string }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [goal, setGoal] = useState<PrimaryGoal | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [units, setUnits] = useState<UnitSystem>("imperial");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [cm, setCm] = useState("");
  const [weight, setWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [showGoalWeight, setShowGoalWeight] = useState(false);
  const [pace, setPace] = useState<WeeklyRateKg>(0);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState<number>(45);
  const [preset, setPreset] = useState<string | null>(null);
  const [dietType, setDietType] = useState<DietType>("balanced");
  const [name, setName] = useState(initialName);
  const [faith, setFaith] = useState(false);
  const [secondGoal, setSecondGoal] = useState<SecondaryGoal | null>(null);
  const [textSize, setTextSize] = useState<TextSize>("default");
  const [reduceMotion, setReduceMotion] = useState(false);

  const current: StepId = STEPS[step]!.id;
  const unit = weightUnit(units);

  const heightCm = (): number | null => {
    if (units === "metric") return cm ? Number(cm) : null;
    if (!feet) return null;
    return feetInchesToCm(Number(feet), Number(inches || 0));
  };
  const weightKg = (): number | null => (weight && Number(weight) > 0 ? toKg(Number(weight), units) : null);
  const goalWeightKg = (): number | null => (showGoalWeight && goalWeight && Number(goalWeight) > 0 ? toKg(Number(goalWeight), units) : null);

  // Pace options follow the goal weight's direction; keep the chosen pace if it still fits.
  const options = paceOptions(WEEKLY_RATES_KG, weightKg(), goalWeightKg());
  const toward = rateTowardGoal(weightKg() ?? 0, goalWeightKg(), pace);
  const effectivePace: WeeklyRateKg = options.includes(pace)
    ? pace
    : options.includes(toward)
      ? toward
      : (options.find((r) => Math.abs(r) === 0.5) ?? options[0] ?? 0);
  const recommended = goal ? defaultWeeklyRate(goal) : null;

  const switchUnits = (next: UnitSystem) => {
    if (next === units) return;
    const h = heightCm();
    const w = weightKg();
    const gw = goalWeight && Number(goalWeight) > 0 ? toKg(Number(goalWeight), units) : null;
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
    if (gw) setGoalWeight(String(displayWeight(gw, next)));
  };

  const chooseGoal = (g: PrimaryGoal) => {
    setGoal(g);
    if (secondGoal === g) setSecondGoal(null);
    setPace(defaultWeeklyRate(g));
    setShowGoalWeight(WEIGHT_GOALS.includes(g));
  };

  const validate = (id: StepId): string | null => {
    switch (id) {
      case "goal":
        return goal ? null : "Choose your main goal.";
      case "second":
        return secondGoal && secondGoal === goal ? "Pick a different second goal, or skip." : null;
      case "comfort":
        return null;
      case "sex":
        return sex ? null : "Please choose male, female or prefer not to say.";
      case "age": {
        const a = Number(age);
        if (!age || !Number.isInteger(a)) return "Please enter your age in whole years.";
        if (a < 18) return "Narrow Gate Fitness is available to adults (18+) at launch.";
        if (a > 100) return "Please check your age.";
        return null;
      }
      case "height": {
        if (units === "imperial" && inches && (Number(inches) < 0 || Number(inches) > 11)) return "Inches should be between 0 and 11.";
        const h = heightCm();
        return !h || h < 90 || h > 260 ? "Please enter a valid height." : null;
      }
      case "weight": {
        const w = weightKg();
        return !w || w < 25 || w > 400 ? "Please enter a valid weight." : null;
      }
      case "target": {
        if (!showGoalWeight || !goalWeight) return null;
        const g = goalWeightKg();
        return !g || g < 25 || g > 400 ? "Please enter a valid goal weight, or skip it." : null;
      }
      case "activity":
        return activity ? null : "Choose how active you are outside workouts.";
      case "experience":
        return experience ? null : "Choose your training experience.";
      case "schedule":
        return days >= 1 && days <= 7 && (SESSION_MINUTES as readonly number[]).includes(minutes) ? null : "Choose your days per week and session length.";
      case "equipment":
        return preset ? null : "Choose the equipment you have.";
      case "diet":
        return null;
      case "finish":
        return name.trim() ? null : "Please enter your name.";
    }
  };

  const next = () => {
    const msg = validate(current);
    setError(msg);
    if (!msg) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const skip = () => {
    if (current === "second") setSecondGoal(null);
    if (current === "comfort") {
      setTextSize("default");
      setReduceMotion(false);
      applyDisplayPrefs("default", false);
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const chooseTextSize = (t: TextSize) => {
    setTextSize(t);
    applyDisplayPrefs(t, reduceMotion);
  };
  const chooseReduceMotion = (on: boolean) => {
    setReduceMotion(on);
    applyDisplayPrefs(textSize, on);
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = () => {
    for (const s of STEPS) {
      const msg = validate(s.id);
      if (msg) {
        setError(msg);
        setStep(STEPS.findIndex((x) => x.id === s.id));
        return;
      }
    }
    setError(null);
    const equipment = EQUIPMENT_PRESETS.find((p) => p.label === preset)!.items;
    startTransition(async () => {
      const res = await completeOnboardingAction({
        displayName: name.trim(),
        primaryGoal: goal!,
        sex: sex!,
        age: Number(age),
        unitSystem: units,
        heightCm: Math.round((heightCm() ?? 0) * 10) / 10,
        weightKg: weightKg()!,
        goalWeightKg: goalWeightKg(),
        weeklyChangeKg: effectivePace,
        activityLevel: activity!,
        experience: experience!,
        daysPerWeek: days,
        sessionMinutes: minutes,
        equipment,
        dietType,
        faithEnabled: faith,
        secondaryGoal: secondGoal,
        textSize,
        reduceMotion,
      });
      // On success the action redirects to the plan summary; we only get here on failure.
      if (res && !res.ok) setError(res.message ?? "Something went wrong. Please try again.");
    });
  };

  const unitsToggle = (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Units">
      <Choice selected={units === "imperial"} onClick={() => switchUnits("imperial")} title="lb / ft" />
      <Choice selected={units === "metric"} onClick={() => switchUnits("metric")} title="kg / cm" />
    </div>
  );

  const gwKg = goalWeightKg();
  const h = heightCm();
  const lowGoal = gwKg && h ? bmi(gwKg, h) < 18.5 : false;
  const last = step === STEPS.length - 1;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span>
            Question {step + 1} of {STEPS.length}
          </span>
          <span className="text-gold">{STEPS[step]!.title}</span>
        </div>
        <ProgressBar value={((step + 1) / STEPS.length) * 100} label="Onboarding progress" />
      </div>

      <form
        noValidate
        className="rounded-2xl border border-border bg-card p-5 md:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (last) submit();
          else next();
        }}
      >
        {current === "goal" && (
          <Question title="What's your main goal?" help="We'll build your first program and calorie budget around it.">
            <div className="grid gap-2 sm:grid-cols-2">
              {PRIMARY_GOALS.map((g) => (
                <Choice key={g} selected={goal === g} onClick={() => chooseGoal(g)} title={GOAL_LABELS[g]} />
              ))}
            </div>
          </Question>
        )}

        {current === "second" && (
          <Question
            title="Anything else you're working toward?"
            help="Optional. Your program is built around your main goal; we'll note this one on your plan so you can keep it in view. Skip if there's nothing else."
          >
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Second goal">
              {SECONDARY_GOALS.filter((g) => g !== goal).map((g) => (
                <Choice key={g} selected={secondGoal === g} onClick={() => setSecondGoal(secondGoal === g ? null : g)} title={SECONDARY_GOAL_LABELS[g]} />
              ))}
            </div>
          </Question>
        )}

        {current === "comfort" && (
          <Question title="Make it comfortable to read" help="Optional. Changes apply right away, and you can change them later in Profile & Settings.">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
              {TEXT_SIZES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={textSize === t.value}
                  onClick={() => chooseTextSize(t.value)}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center",
                    textSize === t.value ? "border-gold bg-gold/12 text-gold-highlight" : "border-border bg-elevated hover:border-gold-muted",
                  )}
                >
                  <span className={cn("font-semibold leading-none", t.sample)} aria-hidden>
                    Aa
                  </span>
                  <span className="mt-1 text-xs">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-border bg-elevated/40 p-4">
              <div>
                <p id="ob-motion-label" className="text-sm font-semibold">
                  Reduce motion
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Turns off animations and transitions.</p>
              </div>
              <Switch checked={reduceMotion} onCheckedChange={chooseReduceMotion} aria-labelledby="ob-motion-label" />
            </div>
          </Question>
        )}

        {current === "sex" && (
          <Question title="What's your sex?" help="Only used to estimate your daily calories (men and women burn different amounts at rest). Never shared.">
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Sex">
              <Choice selected={sex === "male"} onClick={() => setSex("male")} title="Male" />
              <Choice selected={sex === "female"} onClick={() => setSex("female")} title="Female" />
              <Choice selected={sex === "unspecified"} onClick={() => setSex("unspecified")} title="Prefer not to say" />
            </div>
          </Question>
        )}

        {current === "age" && (
          <Question title="How old are you?" help="Used to confirm you're an adult and to estimate your calorie needs.">
            <div className="max-w-40 space-y-2">
              <Label htmlFor="ob-age">Age</Label>
              <Input id="ob-age" type="number" inputMode="numeric" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
          </Question>
        )}

        {current === "height" && (
          <Question title="How tall are you?" help="Pick your units. This also sets how weights show across the app (you can change it later).">
            {unitsToggle}
            {units === "imperial" ? (
              <div className="grid max-w-72 grid-cols-2 gap-3">
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
              <div className="max-w-40 space-y-2">
                <Label htmlFor="ob-cm">Height (cm)</Label>
                <Input id="ob-cm" type="number" inputMode="decimal" min={90} max={260} value={cm} onChange={(e) => setCm(e.target.value)} />
              </div>
            )}
          </Question>
        )}

        {current === "weight" && (
          <Question title="What do you weigh today?" help="Saved as your first bodyweight entry so you can track progress.">
            {unitsToggle}
            <div className="max-w-48 space-y-2">
              <Label htmlFor="ob-weight">Current weight ({unit})</Label>
              <Input id="ob-weight" type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </Question>
        )}

        {current === "target" && (
          <Question
            title="Your weight goal"
            help={
              goal && WEIGHT_GOALS.includes(goal)
                ? "Optional. Set a goal weight and a weekly pace. Slower paces are easier to stick to."
                : "For your goal, holding your weight steady is a good default. You can still choose to lose or gain."
            }
          >
            {showGoalWeight ? (
              <div className="space-y-2">
                <Label htmlFor="ob-goal-weight">Goal weight ({unit}, optional)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input id="ob-goal-weight" type="number" inputMode="decimal" step="0.1" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} className="max-w-40" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGoalWeight("");
                      setShowGoalWeight(false);
                    }}
                  >
                    Skip goal weight
                  </Button>
                </div>
                {lowGoal && (
                  <Notice tone="warning">That goal weight is below the healthy BMI range for your height. Consider talking with your doctor before aiming for it.</Notice>
                )}
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowGoalWeight(true)}>
                Add a goal weight
              </Button>
            )}
            <div className="space-y-2" role="group" aria-label="Weekly pace">
              <p className="text-sm font-medium">Weekly pace</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((r) => (
                  <Choice key={r} selected={effectivePace === r} onClick={() => setPace(r)} title={paceLabel(r, units)} badge={r === recommended ? "Suggested" : undefined} />
                ))}
              </div>
              {gwKg && options.length < WEEKLY_RATES_KG.length && (
                <p className="text-xs text-muted-foreground">Only paces that move you toward your goal weight are shown.</p>
              )}
            </div>
          </Question>
        )}

        {current === "activity" && (
          <Question title="How active are you outside workouts?" help="Your normal day: job, chores, walking. Workouts are added on top when you log them.">
            <div className="grid gap-2">
              {ACTIVITY_LEVELS.map((a) => (
                <Choice key={a} selected={activity === a} onClick={() => setActivity(a)} title={ACTIVITY_INFO[a].label} description={ACTIVITY_INFO[a].description} />
              ))}
            </div>
          </Question>
        )}

        {current === "experience" && (
          <Question title="How long have you been training?">
            <div className="grid gap-2 sm:grid-cols-2">
              {EXPERIENCE_LEVELS.map((x) => (
                <Choice key={x} selected={experience === x} onClick={() => setExperience(x)} title={EXPERIENCE_LABELS[x]} />
              ))}
            </div>
          </Question>
        )}

        {current === "schedule" && (
          <Question title="How often can you train?" help="We'll fit your program to the days this goal supports.">
            <div className="space-y-2" role="group" aria-label="Days per week">
              <p className="text-sm font-medium">Days per week</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <Choice key={d} selected={days === d} onClick={() => setDays(d)} title={`${d} ${d === 1 ? "day" : "days"}`} />
                ))}
              </div>
            </div>
            <div className="space-y-2" role="group" aria-label="Session length">
              <p className="text-sm font-medium">Session length</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SESSION_MINUTES.map((m) => (
                  <Choice key={m} selected={minutes === m} onClick={() => setMinutes(m)} title={`${m} min`} />
                ))}
              </div>
            </div>
          </Question>
        )}

        {current === "equipment" && (
          <Question title="What equipment do you have?" help="You can fine-tune this later in the program builder.">
            <div className="grid gap-2 sm:grid-cols-2">
              {EQUIPMENT_PRESETS.map((p) => (
                <Choice key={p.label} selected={preset === p.label} onClick={() => setPreset(p.label)} title={p.label} description={p.description} />
              ))}
            </div>
          </Question>
        )}

        {current === "diet" && (
          <Question title="Pick a diet style" help="Sets how your calories split into protein, carbs and fat, and marks foods that fit. Change it any time in Food.">
            <div className="grid gap-2 sm:grid-cols-2">
              {DIET_TYPES.map((d) => (
                <Choice key={d} selected={dietType === d} onClick={() => setDietType(d)} title={DIETS[d].name} description={DIETS[d].tagline} />
              ))}
            </div>
            {DIETS[dietType].caution && <Notice tone="warning">{DIETS[dietType].caution}</Notice>}
          </Question>
        )}

        {current === "finish" && (
          <Question title="Last step">
            <div className="space-y-2">
              <Label htmlFor="ob-name">What should we call you?</Label>
              <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-elevated/40 p-4">
              <div>
                <p id="faith-label" className="text-sm font-semibold">
                  Faith-inspired coaching and reminders
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Let the AI coach and workout reminders draw on Scripture and faith language. The Faith tab is always available either way. You can change this any time.
                </p>
              </div>
              <Switch checked={faith} onCheckedChange={setFaith} aria-labelledby="faith-label" />
            </div>
          </Question>
        )}

        {error && (
          <div className="mt-5">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || pending} className="px-3">
            <ArrowLeft aria-hidden /> <span className={OPTIONAL_STEPS.includes(current) ? "sr-only sm:not-sr-only" : undefined}>Back</span>
          </Button>
          {last ? (
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? "Building your plan…" : "Build my plan"}
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              {OPTIONAL_STEPS.includes(current) && (
                <Button type="button" variant="ghost" onClick={skip}>
                  Skip
                </Button>
              )}
              <Button type="submit">
                Continue <ArrowRight aria-hidden />
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
