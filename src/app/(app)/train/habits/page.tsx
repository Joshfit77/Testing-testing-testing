import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { HABIT_PROGRAMS, getHabitProgram } from "@/data/habit-programs";
import { hasFeature } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { listHabitEnrollments } from "@/server/services/habit-programs";

export const metadata = { title: "Habit programs" };

const CATEGORY_LABEL = { nutrition: "Nutrition & habits", faith_fitness: "Faith & fitness", lifestyle: "Lifestyle" } as const;

export default async function HabitProgramsPage() {
  const { user } = await requireOnboardedUser();
  const pro = hasFeature(await getUserPlan(user.id), "full_program_library");
  const enrollments = await listHabitEnrollments(await getServerSupabase(), user.id);
  const active = enrollments.filter((e) => e.status === "active");

  return (
    <div className="space-y-6">
      <BackLink href="/train/programs">Programs</BackLink>
      <PageHeader eyebrow="Pro" title="Habit programs" description="Nutrition, faith-and-fitness and lifestyle programs built from small daily and weekly activities. Miss a day and simply carry on." />
      {active.length > 0 && (
        <section aria-labelledby="active-title" className="space-y-2">
          <h2 id="active-title" className="font-display text-lg font-bold uppercase">In progress</h2>
          {active.map((e) => (
            <Link key={e.id} href={`/train/habits/${e.program_slug}`} className="block min-h-11 rounded-2xl border border-gold/50 bg-card p-4">
              <span className="font-semibold">{getHabitProgram(e.program_slug)?.name ?? e.program_slug}</span>
              <span className="block text-sm text-muted-foreground">Started {e.started_on} · Resume</span>
            </Link>
          ))}
        </section>
      )}
      {(["nutrition", "faith_fitness", "lifestyle"] as const).map((cat) => {
        const list = HABIT_PROGRAMS.filter((p) => p.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="space-y-2" aria-label={CATEGORY_LABEL[cat]}>
            <h2 className="font-display text-lg font-bold uppercase">{CATEGORY_LABEL[cat]}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((p) => (
                <li key={p.slug}>
                  <Link href={`/train/habits/${p.slug}`} className="block h-full min-h-11 rounded-2xl border border-border bg-card p-4 hover:border-gold-muted" data-testid={`habit-card-${p.slug}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{p.name}</span>
                      {!pro && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-gold-highlight">Pro</span>}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{p.summary}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {p.days} days · {p.schedule}
                      {p.needsProfessionalReview ? " · Not yet reviewed by a qualified professional" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">
        The 40-day discipline challenge, with its own daily rules, is on the{" "}
        <Link href="/faith" className="text-gold-highlight underline-offset-4 hover:underline">
          Faith
        </Link>{" "}
        tab.
      </p>
    </div>
  );
}
