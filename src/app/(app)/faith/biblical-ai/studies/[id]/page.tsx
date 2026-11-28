import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { StudyDayToggle } from "@/components/biblical-ai/study-day-toggle";
import { SavedStudyControls } from "@/components/biblical-ai/saved-study-controls";
import { LinkedText } from "@/components/biblical-ai/answer-view";
import type { StudyPlan } from "@/lib/biblical-ai/study-plan";
import { referenceHref } from "@/lib/biblical-ai/links";
import { getServerSupabase } from "@/lib/supabase/server";
import { loadBiblicalAiAccess } from "@/server/biblical-ai-access";

export const metadata = { title: "Personalized study · Narrow Gate Biblical AI" };

/** A personalized study: each day's readings (opened in the Bible), explanation, questions and progress. */
export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await loadBiblicalAiAccess();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("biblical_ai_saved_studies").select("id, kind, title, note, bookmarked, completed_days, content").eq("id", id).maybeSingle();
  if (!data || data.kind !== "plan") notFound();
  const plan = (data.content as { plan: StudyPlan }).plan;
  const done = new Set<number>((data.completed_days as number[]) ?? []);
  const back = `/faith/biblical-ai/studies/${id}`;
  const next = plan.days.find((d) => !done.has(d.day));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith/biblical-ai/saved">Saved studies</BackLink>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
          {plan.durationDays}-day study · {done.size} of {plan.durationDays} done
        </p>
        <h1 className="font-display text-2xl font-bold">{plan.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{plan.objective}</p>
      </header>
      <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuemin={0} aria-valuemax={plan.durationDays} aria-valuenow={done.size} aria-label="Progress">
        <div className="h-full bg-gold" style={{ width: `${(done.size / plan.durationDays) * 100}%` }} />
      </div>
      <ol className="space-y-2" data-testid="study-days">
        {plan.days.map((d) => (
          <li key={d.day}>
            <details className="group rounded-2xl border border-border bg-card" open={d.day === next?.day}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${done.has(d.day) ? "border-gold bg-gold text-black" : "border-gold-muted text-gold-highlight"}`}>{d.day}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{d.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{d.readings.join(" · ")}</span>
                </span>
              </summary>
              <div className="space-y-3 px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {d.readings.map((r) => {
                    const href = referenceHref(r, back);
                    return href ? (
                      <Link key={r} href={href} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-gold-muted px-3 text-sm font-semibold text-gold-highlight hover:bg-gold/10">
                        <BookOpen className="size-4" aria-hidden /> Read {r}
                      </Link>
                    ) : null;
                  })}
                </div>
                <LinkedText text={d.explanation} back={back} className="text-sm" />
                {d.questions.length > 0 && (
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {d.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                )}
                {d.application && <p className="text-sm"><span className="font-semibold">Apply: </span>{d.application}</p>}
                {d.prayer && <p className="text-sm italic text-muted-foreground">Prayer: {d.prayer}</p>}
                <StudyDayToggle studyId={id} day={d.day} done={done.has(d.day)} />
              </div>
            </details>
          </li>
        ))}
      </ol>
      <SavedStudyControls id={id} note={(data.note as string | null) ?? ""} bookmarked={Boolean(data.bookmarked)} />
    </div>
  );
}
