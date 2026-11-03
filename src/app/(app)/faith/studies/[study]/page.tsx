import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { findStudy, STUDY_CATEGORIES } from "@/data/studies";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ study: string }> }) {
  return { title: findStudy((await params).study)?.title ?? "Study" };
}

export default async function StudyPage({ params }: { params: Promise<{ study: string }> }) {
  const study = findStudy((await params).study);
  if (!study) notFound();
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("bible_study_progress").select("lesson_slug, completed_at").eq("user_id", user.id).eq("study_slug", study.slug);
  const done = new Set((data ?? []).filter((r) => r.completed_at).map((r) => r.lesson_slug as string));
  return (
    <div className="space-y-4">
      <BackLink href="/faith/studies">Studies</BackLink>
      <PageHeader eyebrow={STUDY_CATEGORIES[study.category]} title={study.title} description={study.summary} className="mb-2" />
      {study.review.status !== "approved" && (
        <p className="rounded-xl border border-border bg-elevated/50 p-3 text-sm text-muted-foreground">The study notes for this series are being reviewed. You can read each passage and keep your own notes now.</p>
      )}
      <ol className="space-y-2">
        {study.lessons.map((l, i) => (
          <li key={l.slug}>
            <Link href={`/faith/studies/${study.slug}/${l.slug}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
              {done.has(l.slug) ? <CheckCircle2 className="size-5 shrink-0 text-gold" aria-label="Done" /> : <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Lesson {i + 1}</span>
                <span className="block font-semibold">{l.title}</span>
                <span className="block text-sm text-gold-highlight">{l.passage}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
