import { z } from "zod";
import {
  DIETARY_PREFERENCES,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  PRIMARY_GOALS,
  PROGRAM_TYPES,
} from "@/lib/domain/types";

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
    faithEnabled: z.boolean().default(false),
  })
  .refine((v) => !v.limitations || v.wellnessConsent, {
    message: "Please consent to storing limitation notes, or leave them blank",
    path: ["limitations"],
  });
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  unitSystem: unitSystemSchema,
  heightCm: optionalNumber(90, 260),
  timezone: z.string().trim().min(1).max(64),
  faithEnabled: z.boolean(),
});

// --------------------------------------------------------------------------- Workouts
const setSchema = z.object({
  reps: z.number().int().min(0).max(1000).nullable(),
  weightKg: z.number().min(0).max(1500).nullable(),
  durationSeconds: z.number().int().min(0).max(86400).nullable(),
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
  theme: z.enum(FAITH_THEMES).nullable(),
  scriptureRef: z.string().trim().max(80).optional().default(""),
  title: z.string().trim().max(120).optional().default(""),
  body: z.string().trim().min(1, "Write something to save").max(10000),
});

export const disciplineGoalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  cadence: z.enum(["daily", "weekly"]),
});

// --------------------------------------------------------------------------- AI
export const aiChatRequestSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  message: z.string().trim().min(1, "Type a message").max(4000),
  mode: z.enum(["chat", "plan"]).default("chat"),
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
