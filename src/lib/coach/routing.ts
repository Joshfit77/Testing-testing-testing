/**
 * Task-based model routing for the Pro AI coach (pure, unit-tested).
 *
 * Most coaching is quick: answering a question about the athlete's log, explaining an exercise, suggesting a swap.
 * Those run on the fast model (Claude Haiku 5.5). A few tasks benefit from the larger model (Claude Sonnet 5.5):
 * generating a training plan, designing or restructuring a program, reviewing trends over weeks, and anything
 * involving pain, injury or a medical condition, where careful judgment matters most.
 *
 * The larger model is capped per user per month (`aiSmartMonthlyLimit`, about 10% of the Pro allowance), so the
 * mix stays around 90% fast / 10% larger by construction, not by hope. Plan generation always needs the larger
 * model, so complex chat stops escalating a few requests early to leave room for plans.
 */

/** Current model ids (Anthropic, October 2026). Overridable by env without a deploy. */
export const DEFAULT_COACH_MODELS = { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" } as const;
export type ModelTier = keyof typeof DEFAULT_COACH_MODELS;

/** Larger-model requests held back from chat escalation each month, so plan generation stays available. */
export const PLAN_RESERVE = 5;

export function coachModelIds(env: Record<string, string | undefined>): Record<ModelTier, string> {
  return { fast: env.COACH_MODEL_FAST || DEFAULT_COACH_MODELS.fast, smart: env.COACH_MODEL_SMART || DEFAULT_COACH_MODELS.smart };
}

const PROGRAM_WORDS = /\b(program|programme|plan|split|routine|block|mesocycle|periodi[sz]\w*|deload)\b/i;
const DESIGN_VERBS = /\b(build|design|create|write|make|draft|adjust|change|restructure|rework|redo|modify|rearrange|rebuild|overhaul|combine)\b/i;
const REVIEW_WORDS = /\b(review|analy[sz]\w*|assess\w*|evaluat\w*|breakdown|break down|trend\w*|plateau\w*|stall\w*|progress report|look back)\b/i;
const CARE_WORDS =
  /\b(pain\w*|injur\w*|hurt\w*|ache\w*|sprain\w*|strain\w*|tendon\w*|surgery|rehab\w*|physio\w*|pregnan\w*|postpartum|diabet\w*|heart|blood pressure|chest|dizz\w*|faint\w*|eating disorder|binge\w*|purg\w*|starv\w*|medication\w*)\b/i;

export type CoachTaskKind = "quick" | "complex";

/** Classify a chat message. Long or multi-part requests also count as complex. */
export function classifyCoachMessage(message: string): CoachTaskKind {
  const text = message.trim();
  if (!text) return "quick";
  if (CARE_WORDS.test(text)) return "complex";
  if (PROGRAM_WORDS.test(text) && DESIGN_VERBS.test(text)) return "complex";
  if (REVIEW_WORDS.test(text)) return "complex";
  if (text.length > 700) return "complex";
  return "quick";
}

export interface RouteInput {
  mode: "chat" | "plan";
  message: string;
  /** Larger-model requests already used this month. */
  smartUsed: number;
  /** The plan's monthly cap on larger-model requests. */
  smartLimit: number;
  env: Record<string, string | undefined>;
}

export interface Route {
  model: string;
  tier: ModelTier;
  /** Why this tier was chosen (logged for cost review, never shown as a claim to the user). */
  reason: "plan" | "complex" | "quick" | "smart_budget_used";
}

/**
 * Pick the model for one request. Plan generation always uses the larger model (the caller checks the budget
 * first); complex chat uses it while the monthly budget, minus the plan reserve, lasts; everything else is fast.
 */
export function routeCoachRequest(input: RouteInput): Route {
  const ids = coachModelIds(input.env);
  if (input.mode === "plan") return { model: ids.smart, tier: "smart", reason: "plan" };
  if (classifyCoachMessage(input.message) === "quick") return { model: ids.fast, tier: "fast", reason: "quick" };
  const chatBudget = Math.max(0, input.smartLimit - Math.min(PLAN_RESERVE, input.smartLimit));
  if (input.smartUsed < chatBudget) return { model: ids.smart, tier: "smart", reason: "complex" };
  return { model: ids.fast, tier: "fast", reason: "smart_budget_used" };
}
