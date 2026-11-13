import { HABIT_PROGRAMS, getHabitProgram } from "@/data/habit-programs";
import { PROGRAMS } from "@/data/programs";
import { hasFeature } from "@/lib/domain/plans";
import { recommendPrograms, type GeneratorAnswers } from "@/lib/domain/program-generator";
import type { Plan } from "@/lib/domain/types";
import type { CoachProposal } from "./tools";

/**
 * Program suggestions for the AI coach. The ranking is the app's own (recommendPrograms: goal, preferred training
 * types, equipment, experience, days per week); the coach only explains it. Nothing here starts a program: the
 * proposal becomes a card the member must confirm, and confirming re-checks access on the server.
 */

const TOP_TRAINING = 8;

export interface ProgramSuggestionContext {
  answers: GeneratorAnswers | null;
  plan: Plan;
  activeProgram: string | null;
  activeHabitPrograms: string[];
}

export function programRecommendationsForCoach(ctx: ProgramSuggestionContext) {
  const pro = hasFeature(ctx.plan, "full_program_library");
  const library = PROGRAMS.filter((p) => p.category !== "custom");
  const ranked = ctx.answers ? recommendPrograms(ctx.answers, library, ctx.plan).slice(0, TOP_TRAINING) : [];
  const bySlug = new Map(library.map((p) => [p.slug, p]));
  return {
    note: ctx.answers
      ? "Ranked by the app from the athlete's onboarding answers. Recommend only from these lists; weigh their history, limitations and recovery from your context too."
      : "No onboarding answers on file, so training programs are not ranked. Ask about goal, experience, days per week and equipment before recommending one.",
    plan_includes_programs: pro,
    starting_requires: pro ? null : "Pro (programs they started before keep working)",
    active_training_program: ctx.activeProgram,
    active_habit_programs: ctx.activeHabitPrograms,
    training_programs: ranked.map((r) => {
      const p = bySlug.get(r.slug)!;
      return {
        slug: p.slug,
        name: p.name,
        summary: p.summary,
        level: p.difficulty,
        weeks: p.weeks,
        sessions_per_week: p.days.length,
        session_minutes: p.sessionMinutes,
        equipment: p.equipment,
        why_it_fits: r.reasons,
        ...(p.needsSpecialistReview ? { not_yet_reviewed_by_a_qualified_coach: true } : {}),
      };
    }),
    habit_programs: HABIT_PROGRAMS.map((h) => ({
      slug: h.slug,
      name: h.name,
      category: h.category,
      summary: h.summary,
      days: h.days,
      schedule: h.schedule,
      ...(h.needsProfessionalReview ? { not_yet_reviewed_by: h.needsProfessionalReview.who } : {}),
    })),
  };
}

/** Build the confirmation card for a program the coach suggests, or explain why it can't be suggested. */
export function buildProgramProposal(
  slug: string,
  reason: string,
  current: { activeProgram: string | null; activeHabitPrograms: string[] },
): { ok: true; proposal: Extract<CoachProposal, { kind: "program_start" }> } | { ok: false; error: string } {
  const training = PROGRAMS.find((p) => p.slug === slug && p.category !== "custom");
  if (training) {
    if (current.activeProgram === training.name) return { ok: false, error: `${training.name} is already their active program.` };
    return {
      ok: true,
      proposal: {
        kind: "program_start",
        programType: "training",
        slug,
        name: training.name,
        summary: `${training.weeks} weeks · ${training.days.length} sessions a week · ${training.sessionMinutes} min`,
        reason,
        replaces: current.activeProgram,
      },
    };
  }
  const habit = getHabitProgram(slug);
  if (habit) {
    if (current.activeHabitPrograms.includes(slug)) return { ok: false, error: `They're already doing ${habit.name}.` };
    return {
      ok: true,
      proposal: { kind: "program_start", programType: "habit", slug, name: habit.name, summary: `${habit.days} days · ${habit.schedule}`, reason, replaces: null },
    };
  }
  return { ok: false, error: `No program "${slug}". Use a slug from get_program_recommendations.` };
}
