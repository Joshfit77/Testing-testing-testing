import { describe, expect, it } from "vitest";
import { buildProgramProposal, programRecommendationsForCoach } from "@/lib/coach/program-recommendations";
import { coachProposalSchema, validateToolInput } from "@/lib/coach/tools";
import { HABIT_PROGRAMS } from "@/data/habit-programs";
import { PROGRAMS } from "@/data/programs";
import { isListedProgram } from "@/data/program-retirements";
import { executeCoachTool, type ToolContext } from "@/server/coach/tools";
import { athleteFixture, fakeSupabase } from "./fixtures/coach-fixtures";

const USER = "11111111-1111-1111-1111-111111111111";
const ctx = (supabase: ToolContext["supabase"]): ToolContext => ({ supabase, userId: USER, timeZone: "UTC", snapshot: athleteFixture(), proposal: null });
const ANSWERS = { primary_goal: "build_strength", experience: "beginner", days_per_week: 3, session_minutes: 60, equipment: ["barbell", "rack", "bench", "dumbbell"], preferred_types: ["strength"] };

describe("AI coach program recommendations", () => {
  it("ranks only library programs from the member's own answers and lists every habit program", () => {
    const r = programRecommendationsForCoach({ answers: ANSWERS as never, plan: "pro", activeProgram: null, activeHabitPrograms: [] });
    expect(r.training_programs.length).toBeGreaterThan(0);
    expect(r.training_programs.length).toBeLessThanOrEqual(8);
    for (const p of r.training_programs) expect(PROGRAMS.some((x) => x.slug === p.slug && x.category !== "custom")).toBe(true);
    expect(r.training_programs[0]!.why_it_fits).toContain("Matches your primary goal");
    expect(r.habit_programs.map((h) => h.slug).sort()).toEqual(HABIT_PROGRAMS.map((h) => h.slug).sort());
    expect(r.plan_includes_programs).toBe(true);
  });

  it("doesn't rank without answers, and tells a Free member that starting needs Pro", () => {
    const r = programRecommendationsForCoach({ answers: null, plan: "free", activeProgram: null, activeHabitPrograms: [] });
    expect(r.training_programs).toEqual([]);
    expect(r.note).toMatch(/not ranked/);
    expect(r.plan_includes_programs).toBe(false);
    expect(r.starting_requires).toMatch(/Pro/);
  });

  it("flags programs that still need professional review", () => {
    const r = programRecommendationsForCoach({ answers: null, plan: "pro", activeProgram: null, activeHabitPrograms: [] });
    const flagged = HABIT_PROGRAMS.filter((h) => h.needsProfessionalReview).map((h) => h.slug);
    expect(flagged.length).toBeGreaterThan(0);
    for (const h of r.habit_programs) expect("not_yet_reviewed_by" in h).toBe(flagged.includes(h.slug));
  });
});

describe("AI coach program proposals", () => {
  const training = PROGRAMS.find((p) => p.category !== "custom" && isListedProgram(p.slug))!;
  const habit = HABIT_PROGRAMS[0]!;

  it("builds a confirmation card that names the program it would pause", () => {
    const r = buildProgramProposal(training.slug, "Fits your three days a week.", { activeProgram: "Old Plan", activeHabitPrograms: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal).toMatchObject({ kind: "program_start", programType: "training", slug: training.slug, name: training.name, replaces: "Old Plan" });
    expect(coachProposalSchema.safeParse(r.proposal).success).toBe(true);
  });

  it("builds habit-program cards without replacing anything", () => {
    const r = buildProgramProposal(habit.slug, "You asked for help with meals.", { activeProgram: "Old Plan", activeHabitPrograms: [] });
    expect(r.ok && r.proposal.programType === "habit" && r.proposal.replaces === null).toBe(true);
  });

  it("refuses unknown programs and ones already in progress", () => {
    expect(buildProgramProposal("made-up-program", "x", { activeProgram: null, activeHabitPrograms: [] }).ok).toBe(false);
    expect(buildProgramProposal(training.slug, "x", { activeProgram: training.name, activeHabitPrograms: [] }).ok).toBe(false);
    expect(buildProgramProposal(habit.slug, "x", { activeProgram: null, activeHabitPrograms: [habit.slug] }).ok).toBe(false);
  });

  it("validates tool input", () => {
    expect(validateToolInput("propose_program", { program_slug: training.slug, reason: "Fits your week." }).ok).toBe(true);
    expect(validateToolInput("propose_program", { program_slug: "Bad Slug!", reason: "Fits your week." }).ok).toBe(false);
    expect(validateToolInput("propose_program", { program_slug: training.slug }).ok).toBe(false);
  });

  it("the tool only proposes: it writes nothing and returns a card", async () => {
    const { client, log } = fakeSupabase({});
    const out = await executeCoachTool(ctx(client), "propose_program", { program_slug: training.slug, reason: "Fits your week." });
    expect(out.isError).toBe(false);
    expect(out.proposal?.kind).toBe("program_start");
    expect(JSON.parse(out.content)).toMatchObject({ started: false });
    const writes = log.flatMap((l) => l.calls).filter(([m]) => ["insert", "update", "upsert", "delete"].includes(m));
    expect(writes).toEqual([]);
  });

  it("recommendation tool reads the member's answers and plan", async () => {
    const { client } = fakeSupabase({ onboarding_answers: { data: ANSWERS, error: null }, user_entitlements: { data: { plan: "pro", valid_until: null }, error: null } });
    const out = await executeCoachTool(ctx(client), "get_program_recommendations", {});
    expect(out.isError).toBe(false);
    const body = JSON.parse(out.content);
    expect(body.plan_includes_programs).toBe(true);
    expect(body.training_programs.length).toBeGreaterThan(0);
  });
});

describe("habit programs link to real training programs", () => {
  it("every linkedProgramSlug exists", () => {
    for (const h of HABIT_PROGRAMS) if (h.linkedProgramSlug) expect(PROGRAMS.some((p) => p.slug === h.linkedProgramSlug), h.slug).toBe(true);
  });
});
