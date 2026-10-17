"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  BicepsFlexed,
  Check,
  Dumbbell,
  Hammer,
  HeartPulse,
  Loader2,
  Medal,
  Shuffle,
  Swords,
  Target,
  Weight,
  Zap,
} from "lucide-react";
import { Notice } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  buildCustomProgram,
  CARDIO_MODALITIES,
  CARDIO_MODALITY_LABELS,
  CUSTOM_PROGRAM_TYPES,
  CUSTOM_TYPES,
  MAIN_LIFT_LABELS,
  resolveGoalMaxes,
  resolveMaxes,
  SHOW_DIVISION_LABELS,
  SHOW_DIVISIONS,
  weeksRange,
  type CardioModality,
  type CustomProgramType,
  type MainLift,
  type ShowDivision,
} from "@/lib/domain/custom-programs";
import { intensityLabel } from "@/lib/domain/program-expansion";
import type { CatalogExercise } from "@/lib/domain/program-generator";
import { estimateOneRepMax } from "@/lib/domain/strength";
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  type Equipment,
  type ExperienceLevel,
  type UnitSystem,
} from "@/lib/domain/types";
import { cmToFeetInches, displayWeight, feetInchesToCm, formatDuration, toKg, weightUnit } from "@/lib/domain/units";
import { cn } from "@/lib/utils";
import type { CustomProgramFormInput } from "@/lib/validation/schemas";
import { buildCustomProgramAction } from "@/server/actions/custom-programs";

const TYPE_ICONS: Record<CustomProgramType, LucideIcon> = {
  strength: Dumbbell,
  powerlifting: Weight,
  bench: Target,
  deadlift: ArrowUpFromLine,
  squat: Anchor,
  mma: Swords,
  cardio: HeartPulse,
  bodybuilding: BicepsFlexed,
  show_prep: Medal,
  strongman: Hammer,
  speed: Zap,
  agility: Shuffle,
};

/** Equipment each style makes the most of — used for a gentle hint on the equipment step. */
const RECOMMENDED_EQUIPMENT: Record<CustomProgramType, Equipment[]> = {
  strength: ["barbell", "rack", "bench", "pull_up_bar"],
  powerlifting: ["barbell", "rack", "bench"],
  bench: ["barbell", "rack", "bench"],
  deadlift: ["barbell", "rack"],
  squat: ["barbell", "rack"],
  mma: ["heavy_bag", "medicine_ball", "box", "trap_bar"],
  cardio: [],
  bodybuilding: ["dumbbell", "cable", "machine", "bench"],
  show_prep: ["dumbbell", "cable", "machine", "bench"],
  strongman: ["barbell", "strongman_implements", "sandbag", "sled"],
  speed: [],
  agility: [],
};

const EQUIPMENT_PRESETS: { label: string; items: Equipment[] }[] = [
  { label: "Full gym", items: EQUIPMENT.filter((e) => e !== "heavy_bag" && e !== "strongman_implements") as Equipment[] },
  { label: "Home gym", items: ["barbell", "rack", "bench", "dumbbell", "pull_up_bar", "band", "kettlebell"] },
  { label: "Dumbbells only", items: ["dumbbell", "bench", "band"] },
  { label: "Bodyweight only", items: ["bodyweight", "mat"] },
];

const MINUTE_OPTIONS = [20, 30, 40, 45, 50, 60, 75, 90, 120];

type StepId = "type" | "about" | "goals" | "numbers" | "equipment" | "review";
const STEP_LABELS: Record<StepId, string> = {
  type: "Program type",
  about: "About you",
  goals: "Goals & schedule",
  numbers: "Your numbers",
  equipment: "Equipment",
  review: "Review",
};

interface LiftState {
  mode: "max" | "set";
  weight: string;
  reps: string;
  goal: string;
}
const emptyLift = (): LiftState => ({ mode: "max", weight: "", reps: "5", goal: "" });

export interface BuilderInitial {
  units: UnitSystem;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  experience?: ExperienceLevel;
  daysPerWeek?: number;
  sessionMinutes?: number;
  equipment: Equipment[];
}

function Choice({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition-colors",
        selected ? "border-gold bg-gold/12 text-gold-highlight" : "border-border bg-elevated text-foreground hover:border-gold-muted",
        className,
      )}
    >
      {selected && <Check className="size-4 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function ProgramBuilder({
  initial,
  initialType,
  catalog,
}: {
  initial: BuilderInitial;
  initialType: CustomProgramType | null;
  catalog: CatalogExercise[];
}) {
  const units = initial.units;
  const unit = weightUnit(units);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<CustomProgramType | null>(initialType);
  const cfg = type ? CUSTOM_TYPES[type] : null;
  const [goal, setGoal] = useState<string>(initialType ? CUSTOM_TYPES[initialType].goals[0]!.id : "");
  const [experience, setExperience] = useState<ExperienceLevel>(initial.experience ?? "beginner");
  const clampDays = (t: CustomProgramType) => {
    const c = CUSTOM_TYPES[t];
    return Math.min(c.days.max, Math.max(c.days.min, initial.daysPerWeek ?? c.days.default));
  };
  const [days, setDays] = useState<number>(() => (initialType ? clampDays(initialType) : 3));
  const [minutes, setMinutes] = useState<number>(() => (initialType ? CUSTOM_TYPES[initialType].defaultMinutes : (initial.sessionMinutes ?? 45)));
  const [weeks, setWeeks] = useState<number>(() => (initialType ? weeksRange(initialType, CUSTOM_TYPES[initialType].goals[0]!.id).default : 8));
  const [division, setDivision] = useState<ShowDivision | null>(null);

  const [age, setAge] = useState(initial.age ? String(initial.age) : "");
  const initFt = initial.heightCm ? cmToFeetInches(initial.heightCm) : null;
  const [feet, setFeet] = useState(initFt ? String(initFt.feet) : "");
  const [inches, setInches] = useState(initFt ? String(initFt.inches) : "");
  const [cm, setCm] = useState(initial.heightCm ? String(Math.round(initial.heightCm)) : "");
  const [weight, setWeight] = useState(initial.weightKg ? String(displayWeight(initial.weightKg, units)) : "");

  const [lifts, setLifts] = useState<Record<MainLift, LiftState>>({ squat: emptyLift(), bench: emptyLift(), deadlift: emptyLift(), press: emptyLift() });
  const [modality, setModality] = useState<CardioModality>("run");
  const [continuous, setContinuous] = useState("");
  const [equipment, setEquipment] = useState<Equipment[]>(initial.equipment.length ? initial.equipment : ["bodyweight", "mat"]);

  const steps: StepId[] = useMemo(
    () => ["type", "about", "goals", ...(cfg && (cfg.lifts.length || cfg.cardioInput) ? (["numbers"] as StepId[]) : []), "equipment", "review"],
    [cfg],
  );
  const [stepIndex, setStepIndex] = useState(initialType ? 1 : 0);
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const goalCfg = cfg?.goals.find((g) => g.id === goal);
  const wr = type ? weeksRange(type, goal) : { min: 4, max: 16, default: 8 };

  const chooseType = (t: CustomProgramType) => {
    const c = CUSTOM_TYPES[t];
    setType(t);
    const g = c.goals[0]!;
    setGoal(g.id);
    setDays(clampDays(t));
    setMinutes(c.defaultMinutes);
    setWeeks(weeksRange(t, g.id).default);
    if (t !== "show_prep") setDivision(null);
    setError(null);
  };

  const chooseGoal = (id: string) => {
    if (!type) return;
    const prevRange = weeksRange(type, goal);
    setGoal(id);
    const next = weeksRange(type, id);
    if (prevRange.min !== next.min || prevRange.max !== next.max || weeks < next.min || weeks > next.max) setWeeks(next.default);
  };

  const heightCm = (): number | null => {
    if (units === "metric") return cm ? Number(cm) : null;
    if (!feet) return null;
    return feetInchesToCm(Number(feet), Number(inches || 0));
  };
  const weightKg = (): number | null => (weight ? toKg(Number(weight), units) : null);

  const liftEntries = (): Partial<Record<MainLift, { weightKg: number; reps: number } | null>> => {
    const out: Partial<Record<MainLift, { weightKg: number; reps: number } | null>> = {};
    for (const l of cfg?.lifts ?? []) {
      const s = lifts[l];
      const w = num(s.weight);
      if (!Number.isFinite(w) || w <= 0) continue;
      const reps = s.mode === "max" ? 1 : Math.round(num(s.reps));
      out[l] = { weightKg: toKg(w, units), reps };
    }
    return out;
  };
  const goalEntries = (): Partial<Record<MainLift, number | null>> => {
    const out: Partial<Record<MainLift, number | null>> = {};
    if (!goalCfg?.peaking) return out;
    for (const l of cfg?.lifts ?? []) {
      const g = num(lifts[l].goal);
      if (Number.isFinite(g) && g > 0) out[l] = toKg(g, units);
    }
    return out;
  };

  const validate = (id: StepId): string | null => {
    if (id === "type" && !type) return "Choose a program type to continue.";
    if (id === "about") {
      const a = num(age);
      if (!Number.isFinite(a)) return "Please enter your age.";
      if (a < 18) return "Narrow Gate Fitness is available to adults (18+) at launch.";
      if (a > 100) return "Please check your age.";
      const h = heightCm();
      if (!h || h < 90 || h > 260) return "Please enter a valid height.";
      const w = weightKg();
      if (!w || w < 25 || w > 400) return "Please enter a valid bodyweight.";
    }
    if (id === "goals") {
      if (!goalCfg) return "Choose a goal.";
      if (type === "show_prep" && !division) return "Choose your division.";
      if (weeks < wr.min || weeks > wr.max) return `Choose ${wr.min}–${wr.max} weeks.`;
    }
    if (id === "numbers") {
      for (const l of cfg?.lifts ?? []) {
        const s = lifts[l];
        if (!s.weight.trim()) continue;
        const w = num(s.weight);
        const kg = Number.isFinite(w) ? toKg(w, units) : NaN;
        if (!Number.isFinite(kg) || kg < 10 || kg > 500) return `Check the weight for ${MAIN_LIFT_LABELS[l].toLowerCase()}.`;
        if (s.mode === "set") {
          const r = num(s.reps);
          if (!Number.isInteger(r) || r < 1 || r > 12) return `Use a set of 1–12 reps for ${MAIN_LIFT_LABELS[l].toLowerCase()} — estimates get unreliable above that.`;
        }
      }
      if (cfg?.cardioInput && continuous.trim()) {
        const c = num(continuous);
        if (!Number.isInteger(c) || c < 0 || c > 180) return "Enter continuous minutes between 0 and 180.";
      }
    }
    return null;
  };

  const payload = (): CustomProgramFormInput | null => {
    if (!type || !goalCfg) return null;
    const h = heightCm();
    const w = weightKg();
    if (!h || !w) return null;
    return {
      type,
      goal,
      experience,
      daysPerWeek: days,
      sessionMinutes: minutes,
      weeks,
      age: Math.round(num(age)),
      heightCm: Math.round(h * 10) / 10,
      weightKg: w,
      lifts: liftEntries(),
      goalLifts: goalEntries(),
      cardio: cfg?.cardioInput ? { modality: goal === "first_5k" ? "run" : modality, continuousMinutes: continuous.trim() ? Math.round(num(continuous)) : 0 } : null,
      division: type === "show_prep" ? division : null,
      equipment: [...new Set(equipment)],
    };
  };

  const preview = useMemo(() => {
    if (step !== "review") return null;
    const p = payload();
    if (!p) return null;
    try {
      const maxesKg = resolveMaxes(p.type, p.lifts ?? {});
      return buildCustomProgram(
        {
          type: p.type,
          goal: p.goal,
          experience: p.experience,
          daysPerWeek: p.daysPerWeek,
          sessionMinutes: p.sessionMinutes,
          weeks: p.weeks,
          units,
          age: p.age,
          heightCm: p.heightCm,
          bodyweightKg: p.weightKg,
          maxesKg,
          goalMaxesKg: resolveGoalMaxes(p.type, p.goalLifts ?? {}, maxesKg),
          cardio: p.cardio ?? null,
          division: p.division ?? null,
          equipment: p.equipment,
        },
        catalog,
      );
    } catch {
      return null;
    }
    // payload() reads the state listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, type, goal, experience, days, minutes, weeks, age, feet, inches, cm, weight, lifts, modality, continuous, division, equipment, catalog, units]);
  const [previewWeek, setPreviewWeek] = useState(1);
  const names = useMemo(() => new Map(catalog.map((e) => [e.slug, e.name])), [catalog]);

  const next = () => {
    const msg = validate(step);
    setError(msg);
    if (!msg) {
      setStepIndex((i) => Math.min(steps.length - 1, i + 1));
      if (steps[stepIndex + 1] === "review") setPreviewWeek(1);
    }
  };
  const back = () => {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const submit = () => {
    for (const id of steps) {
      const msg = validate(id);
      if (msg) {
        setError(msg);
        setStepIndex(steps.indexOf(id));
        return;
      }
    }
    const p = payload();
    if (!p) {
      setError("Please complete every step.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await buildCustomProgramAction(p);
      // On success the action redirects; a returned state means it failed.
      if (res && !res.ok) {
        const firstField = res.fieldErrors ? Object.values(res.fieldErrors)[0] : undefined;
        setError(firstField ? `${res.message ?? "Please check your answers."} ${firstField}` : (res.message ?? "Something went wrong."));
      }
    });
  };

  const toggleEquipment = (e: Equipment) => setEquipment((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]));
  const setLift = (l: MainLift, patch: Partial<LiftState>) => setLifts((s) => ({ ...s, [l]: { ...s[l], ...patch } }));

  const missingRecommended = type ? RECOMMENDED_EQUIPMENT[type].filter((e) => !equipment.includes(e)) : [];
  const barbellType = type ? ["strength", "powerlifting", "bench", "deadlift", "squat", "strongman"].includes(type) : false;

  return (
    <div className="space-y-6">
      <style>{`@keyframes ngf-builder-step-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>
      <div>
        <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <span className="text-gold">{STEP_LABELS[step]}</span>
        </div>
        <ProgressBar value={((stepIndex + 1) / steps.length) * 100} label="Program builder progress" />
        <ol className="mt-3 hidden gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:flex" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s} aria-current={i === stepIndex ? "step" : undefined} className={cn("flex-1 truncate", i === stepIndex && "text-gold-highlight", i < stepIndex && "text-foreground/80")}>
              {i + 1}. {STEP_LABELS[s]}
            </li>
          ))}
        </ol>
      </div>

      <div key={step} className="rounded-2xl border border-border bg-card p-5 motion-safe:animate-[ngf-builder-step-in_260ms_ease-out] md:p-6">
        <h2 ref={headingRef} tabIndex={-1} className="mb-4 font-display text-2xl font-bold uppercase outline-none">
          {step === "type" && "What do you want to train for?"}
          {step === "about" && "About you"}
          {step === "goals" && `${cfg?.label ?? "Your"} goals & schedule`}
          {step === "numbers" && "Your numbers"}
          {step === "equipment" && "Your equipment"}
          {step === "review" && "Review your program"}
        </h2>

        {step === "type" && (
          <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Program type">
            {CUSTOM_PROGRAM_TYPES.map((t) => {
              const c = CUSTOM_TYPES[t];
              const Icon = TYPE_ICONS[t];
              const selected = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseType(t)}
                  className={cn(
                    "flex min-h-20 items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5",
                    selected ? "border-gold bg-gold/10 shadow-[0_8px_24px_-16px_rgba(201,165,76,0.8)]" : "border-border bg-elevated hover:border-gold-muted",
                  )}
                >
                  <span className={cn("rounded-xl p-2.5", selected ? "bg-gold text-primary-foreground" : "bg-gold/10 text-gold")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-bold uppercase leading-tight">{c.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{c.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === "about" && (
          <fieldset className="space-y-5">
            <legend className="sr-only">About you</legend>
            <p className="text-sm text-muted-foreground">Prefilled from your profile. Saving your program updates your height and age and logs today&apos;s bodyweight.</p>
            <div className="space-y-2">
              <Label htmlFor="pb-age">Age</Label>
              <Input id="pb-age" type="number" inputMode="numeric" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            {units === "imperial" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pb-ft">Height (ft)</Label>
                  <Input id="pb-ft" type="number" inputMode="numeric" min={3} max={8} value={feet} onChange={(e) => setFeet(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pb-in">Height (in)</Label>
                  <Input id="pb-in" type="number" inputMode="numeric" min={0} max={11} value={inches} onChange={(e) => setInches(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pb-cm">Height (cm)</Label>
                <Input id="pb-cm" type="number" inputMode="decimal" min={90} max={260} value={cm} onChange={(e) => setCm(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pb-weight">Bodyweight ({unit})</Label>
              <Input id="pb-weight" type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Units follow your profile setting ({units === "imperial" ? "lb, ft/in" : "kg, cm"}). Change it in Profile.</p>
          </fieldset>
        )}

        {step === "goals" && cfg && (
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Your goal</legend>
              <div className="grid gap-2">
                {cfg.goals.map((g) => (
                  <Choice key={g.id} selected={goal === g.id} onClick={() => chooseGoal(g.id)} className="items-start py-3">
                    <span>
                      <span className="block font-semibold">{g.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">{g.description}</span>
                    </span>
                  </Choice>
                ))}
              </div>
            </fieldset>

            {type === "show_prep" && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Division</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SHOW_DIVISIONS.map((d) => (
                    <Choice key={d} selected={division === d} onClick={() => setDivision(d)}>
                      {SHOW_DIVISION_LABELS[d]}
                    </Choice>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Nutrition, water and peak-week decisions should be guided by a qualified coach or registered dietitian. This builder
                  covers training, conditioning and posing practice only.
                </p>
              </fieldset>
            )}

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Training experience</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXPERIENCE_LEVELS.map((x) => (
                  <Choice key={x} selected={experience === x} onClick={() => setExperience(x)}>
                    {EXPERIENCE_LABELS[x]}
                  </Choice>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pb-days">Days per week</Label>
                <NativeSelect id="pb-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  {Array.from({ length: cfg.days.max - cfg.days.min + 1 }, (_, i) => cfg.days.min + i).map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pb-min">Session length</Label>
                <NativeSelect id="pb-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                  {MINUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pb-weeks">{goalCfg?.event ? (cfg.eventLabel ?? "Weeks until your event") : "Program length"}</Label>
                <NativeSelect id="pb-weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                  {Array.from({ length: wr.max - wr.min + 1 }, (_, i) => wr.min + i).map((w) => (
                    <option key={w} value={w}>
                      {w} weeks
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            {goalCfg?.event && (
              <p className="text-xs text-muted-foreground">
                Your program ends in the week of your {type === "mma" ? "fight" : type === "show_prep" ? "show" : type === "strongman" ? "contest" : "meet"}, with a
                taper built in.
              </p>
            )}
          </div>
        )}

        {step === "numbers" && cfg && (
          <div className="space-y-5">
            {cfg.lifts.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Enter a 1-rep max or a recent best set and we&apos;ll calculate your working weights. Leave any lift blank to use effort-based
                (RPE) targets instead.
              </p>
            )}
            {cfg.lifts.map((l) => {
              const s = lifts[l];
              const w = num(s.weight);
              const reps = s.mode === "max" ? 1 : num(s.reps);
              const e1rmKg = Number.isFinite(w) && w > 0 && Number.isInteger(reps) ? estimateOneRepMax(toKg(w, units), reps) : null;
              return (
                <fieldset key={l} className="space-y-3 rounded-xl border border-border bg-elevated/40 p-4">
                  <legend className="px-1 text-sm font-semibold">{MAIN_LIFT_LABELS[l]}</legend>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label={`${MAIN_LIFT_LABELS[l]} entry type`}>
                    <Choice selected={s.mode === "max"} onClick={() => setLift(l, { mode: "max" })}>
                      I know my 1RM
                    </Choice>
                    <Choice selected={s.mode === "set"} onClick={() => setLift(l, { mode: "set" })}>
                      Recent best set
                    </Choice>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`pb-${l}-w`}>{s.mode === "max" ? `1-rep max (${unit})` : `Weight (${unit})`}</Label>
                      <Input id={`pb-${l}-w`} type="number" inputMode="decimal" min={0} value={s.weight} onChange={(e) => setLift(l, { weight: e.target.value })} />
                    </div>
                    {s.mode === "set" && (
                      <div className="space-y-2">
                        <Label htmlFor={`pb-${l}-r`}>Reps</Label>
                        <Input id={`pb-${l}-r`} type="number" inputMode="numeric" min={1} max={12} value={s.reps} onChange={(e) => setLift(l, { reps: e.target.value })} />
                      </div>
                    )}
                    {goalCfg?.peaking && (
                      <div className="space-y-2">
                        <Label htmlFor={`pb-${l}-g`}>Goal max ({unit}, optional)</Label>
                        <Input id={`pb-${l}-g`} type="number" inputMode="decimal" min={0} value={s.goal} onChange={(e) => setLift(l, { goal: e.target.value })} />
                      </div>
                    )}
                  </div>
                  {s.mode === "set" && e1rmKg != null && (
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      Estimated 1RM: <span className="font-semibold text-gold-highlight">{displayWeight(e1rmKg, units, 0)} {unit}</span> (Epley formula)
                    </p>
                  )}
                </fieldset>
              );
            })}

            {cfg.cardioInput && (
              <fieldset className="space-y-3 rounded-xl border border-border bg-elevated/40 p-4">
                <legend className="px-1 text-sm font-semibold">Your current cardio</legend>
                {goal !== "first_5k" && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Cardio type">
                    {CARDIO_MODALITIES.map((m) => (
                      <Choice key={m} selected={modality === m} onClick={() => setModality(m)}>
                        {CARDIO_MODALITY_LABELS[m]}
                      </Choice>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="pb-cardio-min">
                    Minutes you can {goal === "first_5k" || modality === "run" ? "run" : modality === "bike" ? "ride" : modality === "row" ? "row" : "walk briskly"} without
                    stopping at an easy pace
                  </Label>
                  <Input
                    id="pb-cardio-min"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={180}
                    placeholder="e.g. 5"
                    value={continuous}
                    onChange={(e) => setContinuous(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Not sure or can&apos;t run yet? Leave it blank or enter 0 — we&apos;ll start with run/walk intervals.</p>
                </div>
              </fieldset>
            )}
          </div>
        )}

        {step === "equipment" && (
          <fieldset className="space-y-4">
            <legend className="sr-only">Available equipment</legend>
            <p className="text-sm text-muted-foreground">Prefilled from your onboarding answers. We only use exercises you can do with what you select.</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_PRESETS.map((p) => (
                <Button key={p.label} type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setEquipment(p.items)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EQUIPMENT.map((e) => (
                <Choice key={e} selected={equipment.includes(e)} onClick={() => toggleEquipment(e)}>
                  {EQUIPMENT_LABELS[e]}
                </Choice>
              ))}
            </div>
            {missingRecommended.length > 0 && (
              <Notice tone="info">
                {cfg?.label} works best with: {missingRecommended.map((e) => EQUIPMENT_LABELS[e].toLowerCase()).join(", ")}.{" "}
                {barbellType && !equipment.includes("barbell")
                  ? "Without a barbell we'll substitute dumbbell or bodyweight versions and use effort (RPE) targets instead of percentages."
                  : "We'll substitute the closest alternatives you can do."}
              </Notice>
            )}
          </fieldset>
        )}

        {step === "review" && (
          <div className="space-y-5">
            {preview ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{cfg?.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{preview.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{preview.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{preview.weeks} weeks</Badge>
                    <Badge variant="secondary">{preview.days.length}×/week</Badge>
                    <Badge variant="secondary">~{preview.sessionMinutes} min</Badge>
                    <Badge variant="secondary">{EXPERIENCE_LABELS[experience]}</Badge>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">Your block</p>
                  <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8" aria-label="Weeks">
                    {(preview.weekTemplates ?? []).map((w, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setPreviewWeek(i + 1)}
                          aria-pressed={previewWeek === i + 1}
                          aria-label={`Week ${i + 1}: ${w.focus}`}
                          className={cn(
                            "flex min-h-11 w-full flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center",
                            previewWeek === i + 1 ? "border-gold bg-gold/12" : w.isDeload ? "border-dashed border-border bg-elevated/40" : "border-border bg-elevated",
                          )}
                        >
                          <span className="text-xs font-semibold">W{i + 1}</span>
                          <span className="w-full truncate text-[10px] text-muted-foreground">{w.focus.split(":")[0]}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>

                {(() => {
                  const w = preview.weekTemplates?.[previewWeek - 1];
                  if (!w) return null;
                  return (
                    <div className="space-y-3">
                      <p className="text-sm">
                        <span className="font-semibold">Week {previewWeek}:</span> <span className="text-muted-foreground">{w.focus}</span>
                      </p>
                      <ul className="grid gap-3 md:grid-cols-2">
                        {w.days.map((d, di) => (
                          <li key={di} className="rounded-xl border border-border bg-elevated/50 p-3">
                            <p className="font-semibold">
                              Day {di + 1} · {d.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {d.focus} · ~{d.minutes} min
                            </p>
                            <ul className="mt-2 space-y-1.5 text-sm">
                              {d.exercises.map((e, ei) => {
                                const label = intensityLabel(e);
                                return (
                                  <li key={ei} className="flex flex-wrap justify-between gap-x-2">
                                    <span>{names.get(e.ex) ?? e.ex}</span>
                                    <span className="text-muted-foreground">
                                      {e.sets} × {e.reps ?? (e.seconds ? formatDuration(e.seconds) : "")}
                                      {label ? ` · ${label}` : ""}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                <div className="rounded-xl border border-border bg-elevated/40 p-4 text-sm">
                  <p className="font-semibold">How it progresses</p>
                  <p className="mt-1 text-muted-foreground">{preview.progression}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{preview.description}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Building replaces your current active program (it stays in My programs, paused). Custom programs are free on every plan.
                </p>
              </>
            ) : (
              <Notice tone="error">We couldn&apos;t preview this program. Go back and check your answers.</Notice>
            )}
          </div>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={back} disabled={stepIndex === 0 || pending}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        {step !== "review" ? (
          <Button type="button" onClick={next}>
            Next <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending || !preview} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? "Building your program…" : "Build & start program"}
          </Button>
        )}
      </div>
    </div>
  );
}
