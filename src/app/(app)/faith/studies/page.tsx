import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { STUDIES, STUDY_CATEGORIES, type StudyCategory } from "@/data/studies";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Guided studies" };

export default async function StudiesPage() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("bible_study_progress").select("study_slug, completed_at").eq("user_id", user.id).not("completed_at", "is", null).limit(1000);
  const done = new Map<string, number>();
  for (const r of data ?? []) done.set(r.study_slug as string, (done.get(r.study_slug as string) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader title="Guided studies" description="Each lesson starts with the passage itself. Free, and at your own pace." className="mb-2" />
      {(Object.keys(STUDY_CATEGORIES) as StudyCategory[]).map((cat) => (
        <section key={cat} aria-labelledby={`cat-${cat}`}>
          <h2 id={`cat-${cat}`} className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
            {STUDY_CATEGORIES[cat]}
          </h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {STUDIES.filter((s) => s.category === cat).map((s) => (
              <li key={s.slug}>
                <Link href={`/faith/studies/${s.slug}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
                  <GraduationCap className="size-5 shrink-0 text-gold" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{s.summary}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.lessons.length} lessons{done.get(s.slug) ? ` · ${done.get(s.slug)} done` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
