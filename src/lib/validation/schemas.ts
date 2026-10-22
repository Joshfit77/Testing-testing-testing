import { z } from "zod";
import { DIET_TYPES } from "@/lib/domain/diets";
import {
  DIETARY_PREFERENCES,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  PRIMARY_GOALS,
  PROGRAM_TYPES,
  SECONDARY_GOALS,
} from "@/lib/domain/types";
import { CARDIO_MODALITIES, COMBINABLE_TYPES, CUSTOM_PROGRAM_TYPES, CUSTOM_TYPES, SHOW_DIVISIONS, weeksRange } from "@/lib/domain/custom-programs";
import { COMBINE_GOALS } from "@/lib/domain/combined-goals";
import { ACTIVITY_LEVELS, isWeeklyRate } from "@/lib/domain/calorie-budget";
import { SESSION_MINUTES } from "@/lib/domain/starter-program";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalNumber = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().min(min).max(max).nullable());

export const unitSystemSchema = z.enum(["imperial", "metric"]);

// --------------------------------------------------------------------------- Auth
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, "Tell us what to call you").max(60),
  ageConfirmed: z.literal("on", { message: "You must be 18 or older to create an account" }),
  termsAccepted: z.literal("on", { message: "Please accept the terms and privacy policy" }),
});

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(128) });
export const resetRequestSchema = z.object({ email: emailSchema });
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

// --------------------------------------------------------------------------- Onboarding / profile
export const onboardingSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    age: z.coerce.number().int().min(18, "Narrow Gate Fitness is for adults (18+) at launch").max(100),
    unitSystem: unitSystemSchema,
    heightCm: z.coerce.number().min(90, "Check your height").max(260, "Check your height"),
    weightKg: z.coerce.number().min(25, "Check your weight").max(400, "Check your weight"),
    primaryGoal: z.enum(PRIMARY_GOALS),
    experience: z.enum(EXPERIENCE_LEVELS),
    daysPerWeek: z.coerce.number().int().min(1).max(7),
    sessionMinutes: z.coerce.number().int().min(10).max(180),
    equipment: z.array(z.enum(EQUIPMENT)).max(EQUIPMENT.length),
    preferredTypes: z.array(z.enum(PROGRAM_TYPES)).max(PROGRAM_TYPES.length),
    limitations: z.string().trim().max(1000).optional().default(""),
    wellnessConsent: z.boolean().default(false),
    dietaryPreferences: z.array(z.enum(DIETARY_PREFERENCES)).max(DIETARY_PREFERENCES.length),
    sex: z.enum(["male", "female", "unspecified"], { message: "Choose male, female or prefer not to say" }),
    dietType: z.enum(DIET_TYPES).default("balanced"),
    faithEnabled: z.boolean().default(false),
    secondaryGoal: z.enum(SECONDARY_GOALS).nullable().optional(),
    textSize: z.enum(["default", "large", "xlarge"]).optional(),
    reduceMotion: z.boolean().optional(),
  })
  .refine((v) => !v.secondaryGoal || v.secondaryGoal !== v.primaryGoal, { message: "Pick a second goal that's different from your main goal", path: ["secondaryGoal"] })
  .refine((v) => !v.limitations || v.wellnessConsent, {
    message: "Please consent to storing limitation notes, or leave them blank",
    path: ["limitations"],
  });
export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Weekly weight change in kg: one of WEEKLY_RATES_KG. */
export const weeklyRateSchema = z.coerce.number().refine(isWeeklyRate, "Choose a weekly pace");
const goalWeightSchema = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().min(25, "Check your goal weight").max(400, "Check your goal weight").nullable(),
);

/** The guided sign-up questionnaire (one question per screen, submitted once at the end). */
export const onboardingPlanSchema = z.object({
  displayName: z.string().trim().min(1, "Please enter your name").max(60),
  primaryGoal: z.enum(PRIMARY_GOALS, { message: "Choose your main goal" }),
  sex: z.enum(["male", "female", "unspecified"], { message: "Choose male, female or prefer not to say" }),
  age: z.coerce.number().int().min(18, "Narrow Gate Fitness is available to adults (18+) at launch.").max(100, "Check your age"),
  unitSystem: unitSystemSchema,
  heightCm: z.coerce.number().min(90, "Check your height").max(260, "Check your height"),
  weightKg: z.coerce.number().min(25, "Check your weight").max(400, "Check your weight"),
  goalWeightKg: goalWeightSchema,
  weeklyChangeKg: weeklyRateSchema,
  activityLevel: z.enum(ACTIVITY_LEVELS, { message: "Choose how active you are outside workouts" }),
  experience: z.enum(EXPERIENCE_LEVELS, { message: "Choose your training experience" }),
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  sessionMinutes: z.coerce
    .number()
    .int()
    .refine((m) => (SESSION_MINUTES as readonly number[]).includes(m), "Choose a session length"),
  equipment: z.array(z.enum(EQUIPMENT)).min(1, "Choose your equipment").max(EQUIPMENT.length),
  dietType: z.enum(DIET_TYPES).default("balanced"),
  faithEnabled: z.boolean().default(false),
  /** Optional steps: a second goal, and text size / reduce motion (written to the profile). */
  secondaryGoal: z.enum(SECONDARY_GOALS).nullable().optional(),
  textSize: z.enum(["default", "large", "xlarge"]).optional(),
  reduceMotion: z.boolean().optional(),
}).refine((v) => !v.secondaryGoal || v.secondaryGoal !== v.primaryGoal, { message: "Pick a second goal that's different from your main goal", path: ["secondaryGoal"] });
export type OnboardingPlanInput = z.input<typeof onboardingPlanSchema>;

/** Goal weight, pace and activity used to recalculate the calorie budget from the Food page. */
export const budgetSettingsSchema = z.object({
  goalWeightKg: goalWeightSchema,
  weeklyChangeKg: weeklyRateSchema,
  activityLevel: z.enum(ACTIVITY_LEVELS, { message: "Choose an activity level" }),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  unitSystem: unitSystemSchema,
  heightCm: optionalNumber(90, 260),
  timezone: z.string().trim().min(1).max(64),
  faithEnabled: z.boolean(),
});

// --------------------------------------------------------------------------- Custom program builder
const liftEntrySchema = z
  .object({
    weightKg: z.number().min(10, "Check the weight").max(500, "Check the weight"),
    reps: z.number().int().min(1).max(12, "Use a set of 12 reps or fewer"),
  })
  .nullable()
  .optional();
const goalLiftSchema = z.number().min(10).max(600).nullable().optional();

export const customProgramSchema = z
  .object({
    type: z.enum(CUSTOM_PROGRAM_TYPES),
    goal: z.string().trim().min(1).max(40),
    experience: z.enum(EXPERIENCE_LEVELS),
    daysPerWeek: z.number().int().min(2).max(6),
    sessionMinutes: z.number().int().min(20).max(120),
    weeks: z.number().int().min(4).max(24),
    age: z.number().int().min(18, "Narrow Gate Fitness is for adults (18+) at launch").max(100),
    heightCm: z.number().min(90, "Check your height").max(260, "Check your height"),
    weightKg: z.number().min(25, "Check your weight").max(400, "Check your weight"),
    lifts: z.object({ squat: liftEntrySchema, bench: liftEntrySchema, deadlift: liftEntrySchema, press: liftEntrySchema }).default({}),
    goalLifts: z.object({ squat: goalLiftSchema, bench: goalLiftSchema, deadlift: goalLiftSchema, press: goalLiftSchema }).default({}),
    cardio: z.object({ modality: z.enum(CARDIO_MODALITIES), continuousMinutes: z.number().int().min(0).max(180) }).nullable().optional(),
    division: z.enum(SHOW_DIVISIONS).nullable().optional(),
    equipment: z.array(z.enum(EQUIPMENT)).max(EQUIPMENT.length),
    combine: z.object({ goal: z.enum(COMBINE_GOALS), days: z.number().int().min(2).max(3) }).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.combine) {
      if (!COMBINABLE_TYPES.includes(v.type)) ctx.addIssue({ code: "custom", path: ["combine"], message: "A second goal can be added to strength or bodybuilding programs" });
      if (v.daysPerWeek + v.combine.days > 7) ctx.addIssue({ code: "custom", path: ["combine"], message: "Strength and run days together can't be more than 7 a week" });
    }
    const cfg = CUSTOM_TYPES[v.type];
    if (!cfg.goals.some((g) => g.id === v.goal)) ctx.addIssue({ code: "custom", path: ["goal"], message: "Choose a goal for this program type" });
    if (v.daysPerWeek < cfg.days.min || v.daysPerWeek > cfg.days.max)
      ctx.addIssue({ code: "custom", path: ["daysPerWeek"], message: `Choose ${cfg.days.min}–${cfg.days.max} days per week` });
    const wr = weeksRange(v.type, v.goal);
    if (v.weeks < wr.min || v.weeks > wr.max) ctx.addIssue({ code: "custom", path: ["weeks"], message: `Choose ${wr.min}–${wr.max} weeks` });
    if (v.type === "show_prep" && !v.division) ctx.addIssue({ code: "custom", path: ["division"], message: "Choose your division" });
  });
export type CustomProgramFormInput = z.input<typeof customProgramSchema>;

// --------------------------------------------------------------------------- Workouts
const setSchema = z.object({
  reps: z.number().int().min(0).max(1000).nullable(),
  weightKg: z.number().min(0).max(1500).nullable(),
  durationSeconds: z.number().int().min(0).max(86400).nullable(),
  // Optional so clients from before distance logging still validate.
  distanceM: z.number().min(0).max(1000000).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable(),
  isWarmup: z.boolean(),
  completed: z.boolean(),
});

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  substitutedFromId: z.string().uuid().nullable(),
  notes: z.string().max(1000),
  skipped: z.boolean(),
  skipReason: z.enum(["pain", "equipment", "time", "other"]).nullable(),
  sets: z.array(setSchema).max(50),
});

export const finishWorkoutSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  userProgramId: z.string().uuid().nullable(),
  programDayId: z.string().uuid().nullable(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  pausedSeconds: z.number().int().min(0).max(86400 * 2),
  notes: z.string().max(2000),
  exercises: z.array(workoutExerciseSchema).max(40),
});
export type FinishWorkoutInput = z.infer<typeof finishWorkoutSchema>;

export const editWorkoutSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  notes: z.string().max(2000),
  exercises: z.array(workoutExerciseSchema).max(40),
});
export type EditWorkoutInput = z.infer<typeof editWorkoutSchema>;

export const draftSnapshotSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  startedAt: z.string().datetime({ offset: true }),
  userProgramId: z.string().uuid().nullable(),
  programDayId: z.string().uuid().nullable(),
  draft: z.record(z.string(), z.unknown()),
});

// --------------------------------------------------------------------------- Body tracking
export const weightEntrySchema = z.object({
  recordedOn: isoDate,
  weight: z.coerce.number().positive().max(900),
});

export const measurementSchema = z.object({
  recordedOn: isoDate,
  waist: optionalNumber(10, 250),
  chest: optionalNumber(10, 250),
  hips: optionalNumber(10, 250),
  arm: optionalNumber(4, 100),
  thigh: optionalNumber(8, 150),
  bodyFatPct: optionalNumber(2, 75),
  notes: z.string().trim().max(500).optional().default(""),
});

export const recoveryCheckinSchema = z.object({
  sleepQuality: z.coerce.number().int().min(1).max(5),
  energy: z.coerce.number().int().min(1).max(5),
  soreness: z.coerce.number().int().min(1).max(5),
  stress: z.coerce.number().int().min(1).max(5),
  notes: z.string().trim().max(500).optional().default(""),
});

export const goalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  goalType: z.enum(["bodyweight", "strength", "frequency", "nutrition", "custom"]),
  targetValue: optionalNumber(0, 100000),
  unit: z.string().trim().max(20).optional().default(""),
  targetDate: isoDate.optional().or(z.literal("")),
});

// --------------------------------------------------------------------------- Nutrition
export const macroFields = {
  calories: z.coerce.number().min(0).max(10000),
  protein_g: z.coerce.number().min(0).max(1000),
  carbs_g: z.coerce.number().min(0).max(2000),
  fat_g: z.coerce.number().min(0).max(1000),
};

export const customFoodSchema = z.object({
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(120).optional().default(""),
  servingSize: z.coerce.number().positive().max(10000),
  servingUnit: z.string().trim().min(1).max(30),
  ...macroFields,
  isEstimate: z.boolean().default(false),
});

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const logFoodSchema = z.object({
  date: isoDate,
  mealType: mealTypeSchema,
  foodId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(160),
  servings: z.coerce.number().positive().max(100),
  ...macroFields,
  isEstimate: z.boolean().default(false),
  status: z.enum(["logged", "planned"]).default("logged"),
});

export const nutritionGoalsSchema = z.object({
  calories: z.coerce.number().int().min(800).max(8000),
  protein_g: z.coerce.number().int().min(0).max(500),
  carbs_g: z.coerce.number().int().min(0).max(1000),
  fat_g: z.coerce.number().int().min(0).max(400),
  water_ml: z.coerce.number().int().min(0).max(10000),
});

export const waterSchema = z.object({ date: isoDate, amountMl: z.coerce.number().int().min(1).max(5000) });

export const savedMealSchema = z.object({
  name: z.string().trim().min(1).max(120),
  yieldServings: z.coerce.number().positive().max(100).default(1),
  notes: z.string().trim().max(1000).optional().default(""),
});

// --------------------------------------------------------------------------- Faith
export const FAITH_THEMES = ["perseverance", "humility", "discipline", "self_control", "stewardship", "gratitude", "other"] as const;

export const journalEntrySchema = z.object({
  entryDate: isoDate,
  kind: z.enum(["reflection", "request", "praise"]).default("reflection"),
  theme: z.enum(FAITH_THEMES).nullable(),
  scriptureRef: z.string().trim().max(80).optional().default(""),
  title: z.string().trim().max(120).optional().default(""),
  body: z.string().trim().min(1, "Write something to save").max(10000),
  /** Off unless the user ticks "Share with AI Coach" on this entry. */
  shareWithCoach: z.boolean().default(false),
});

export const prayerAnsweredSchema = z.object({
  id: z.string().uuid(),
  answeredOn: isoDate,
  note: z.string().trim().max(2000).optional().default(""),
});

export const customPracticeSchema = z.object({
  title: z.string().trim().min(1, "Name your practice").max(120),
});

export const faithReminderSchema = z.object({
  kind: z.enum(["devotional", "prayer", "practices"]),
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time"),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
});
export const faithRemindersSchema = z
  .array(faithReminderSchema)
  .min(1)
  .max(3)
  .refine((list) => new Set(list.map((r) => r.kind)).size === list.length, "Each reminder once")
  .refine((list) => list.every((r) => !r.enabled || r.weekdays.length > 0), "Pick at least one day for each reminder that's on.");

// --------------------------------------------------------------------------- AI
export const aiChatRequestSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  message: z.string().trim().min(1, "Type a message").max(4000),
  mode: z.enum(["chat", "plan"]).default("chat"),
  /** New conversations only: don't remember anything from this chat. */
  memoryOff: z.boolean().optional(),
});

// --------------------------------------------------------------------------- Admin
export const adminExerciseSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80),
  name: z.string().trim().min(2).max(100),
  category: z.enum(["strength", "conditioning", "mobility", "plyometric", "cardio", "core"]),
  movementPattern: z.string().trim().min(1).max(40),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  description: z.string().trim().max(1000),
  primaryMuscles: z.string().trim().max(400),
  equipment: z.string().trim().max(400),
  instructions: z.string().trim().max(5000),
  formCues: z.string().trim().max(2000),
  commonMistakes: z.string().trim().max(2000),
  isPublished: z.boolean(),
  isTimed: z.boolean(),
});

export const adminCategorySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});

export const adminContentSchema = z.object({
  kind: z.enum(["announcement", "tip", "devotional"]),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(10000),
  scriptureRef: z.string().trim().max(80).optional().default(""),
  isPublished: z.boolean(),
});

export const adminProgramSchema = z.object({
  name: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(300),
  description: z.string().trim().max(4000),
  tier: z.enum(["free", "plus", "pro"]),
  isPublished: z.boolean(),
  categoryId: z.string().uuid().nullable(),
});

/** Turn a ZodError into a flat field → message map for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// --------------------------------------------------------------------------- Saved workout templates
export const templateExerciseSchema = z
  .object({
    exerciseId: z.string().uuid(),
    sets: z.number().int().min(1).max(20),
    target: z.enum(["reps", "time", "distance"]),
    reps: z.string().trim().min(1).max(20).nullable(),
    durationSeconds: z.number().int().min(5).max(7200).nullable(),
    distanceM: z.number().positive().max(100000).nullable(),
    restSeconds: z.number().int().min(0).max(900),
    supersetGroup: z.number().int().min(1).max(20).nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.target === "reps" && !v.reps) ctx.addIssue({ code: "custom", path: ["reps"], message: "Enter reps" });
    if (v.target === "time" && !v.durationSeconds) ctx.addIssue({ code: "custom", path: ["durationSeconds"], message: "Enter a time" });
    if (v.target === "distance" && !v.distanceM) ctx.addIssue({ code: "custom", path: ["distanceM"], message: "Enter a distance" });
  });

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Name your workout").max(120),
  notes: z.string().trim().max(2000).nullable(),
  exercises: z.array(templateExerciseSchema).min(1, "Add at least one exercise").max(40),
});
export type TemplateFormInput = z.infer<typeof templateSchema>;
