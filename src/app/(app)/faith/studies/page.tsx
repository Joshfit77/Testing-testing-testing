import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { STUDIES, STUDY_CATEGORIES, type StudyCategory } from "@/data/studies";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Guided studies" };

function StudyGroup({ id, label, studies, done }: { id: string; label: string; studies: typeof STUDIES; done: Map<string, number> }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
        {label}
      </h2>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {studies.map((s) => (
          <li key={s.slug} className="min-w-0">
            <Link href={`/faith/studies/${s.slug}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
              <GraduationCap className="size-5 shrink-0 text-gold" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.title}</span>
                <span className="block truncate text-sm text-muted-foreground">{s.summary}</span>
                <span className="block text-sm text-muted-foreground">
                  {s.lessons.length} lessons{done.get(s.slug) ? ` · ${done.get(s.slug)} done` : ""}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function StudiesPage() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("bible_study_progress").select("study_slug, completed_at").eq("user_id", user.id).not("completed_at", "is", null).limit(1000);
  const done = new Map<string, number>();
  for (const r of data ?? []) done.set(r.study_slug as string, (done.get(r.study_slug as string) ?? 0) + 1);
  // Studies begun but not finished come first, so a member can pick up where they left off.
  const inProgress = STUDIES.filter((s) => (done.get(s.slug) ?? 0) > 0 && (done.get(s.slug) ?? 0) < s.lessons.length);

  return (
    <div className="space-y-6">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader title="Guided studies" description="Each lesson starts with the passage itself. Free, and at your own pace." className="mb-2" />
      {inProgress.length > 0 && <StudyGroup id="in-progress" label="In progress" studies={inProgress} done={done} />}
      {(Object.keys(STUDY_CATEGORIES) as StudyCategory[]).map((cat) => (
        <StudyGroup key={cat} id={`cat-${cat}`} label={STUDY_CATEGORIES[cat]} studies={STUDIES.filter((s) => s.category === cat)} done={done} />
      ))}
    </div>
  );
}
