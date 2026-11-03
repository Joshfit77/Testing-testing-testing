import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CheckCircle2, Circle, TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { StudyNotesForm } from "@/components/faith/study-notes-form";
import { ScriptureText } from "@/components/bible/scripture-text";
import { findLesson, findStudy, notesVisible } from "@/data/studies";
import { chapterHref } from "@/lib/bible/books";
import { parseReference } from "@/lib/bible/reference";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { toggleStudyLessonAction } from "@/server/actions/studies";
import { getPassage, passageParts } from "@/server/bible/text";

export async function generateMetadata({ params }: { params: Promise<{ study: string; lesson: string }> }) {
  const p = await params;
  const study = findStudy(p.study);
  return { title: (study && findLesson(study, p.lesson)?.title) ?? "Lesson" };
}

/**
 * One lesson: the passage in full (Scripture, BSB), then the study notes (commentary, clearly labelled as such, and
 * only once approved by a person), then the member's own notes.
 */
export default async function LessonPage({ params }: { params: Promise<{ study: string; lesson: string }> }) {
  const p = await params;
  const study = findStudy(p.study);
  const lesson = study ? findLesson(study, p.lesson) : undefined;
  const ref = lesson ? parseReference(lesson.passage) : null;
  if (!study || !lesson || !ref) notFound();
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data: progress } = await supabase.from("bible_study_progress").select("completed_at, notes").eq("user_id", user.id).eq("study_slug", study.slug).eq("lesson_slug", lesson.slug).maybeSingle();
  const verses = getPassage(ref);
  const visibility = notesVisible(study, profile.role === "admin");
  const notes = visibility === "hidden" ? undefined : lesson.notes;
  const index = study.lessons.indexOf(lesson);
  const next = study.lessons[index + 1];
  const done = Boolean(progress?.completed_at);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href={`/faith/studies/${study.slug}`}>{study.title}</BackLink>
      <PageHeader eyebrow={`${study.title} · Lesson ${index + 1}`} title={lesson.title} className="mb-2" />

      <section aria-labelledby="passage-title" className="rounded-2xl border border-gold-muted bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="passage-title" className="flex items-center gap-2 font-semibold">
            <BookOpen className="size-5 text-gold" aria-hidden /> {lesson.passage}
          </h2>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Scripture · BSB</span>
        </div>
        <div className="space-y-1 font-serif text-[1.0625rem] leading-relaxed">
          {verses.map((v) => (
            <p key={`${v.chapter}:${v.verse}`}>
              <sup className="mr-1 font-sans text-xs font-semibold text-gold">{ref.chapterEnd ? `${v.chapter}:${v.verse}` : v.verse}</sup>
              <ScriptureText text={v.text} jesus={v.jesus} />
            </p>
          ))}
        </div>
        <Link href={chapterHref(ref.bookId, ref.chapter, ref.verseStart)} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gold-highlight hover:underline">
          Read it in context
        </Link>
      </section>

      {lesson.crossReferences.length > 0 && (
        <section aria-labelledby="xref-title">
          <h2 id="xref-title" className="mb-2 font-semibold">
            Cross-references
          </h2>
          <ul className="space-y-2">
            {lesson.crossReferences.map((x) => {
              const r = parseReference(x);
              const parts = r ? passageParts(r) : null;
              return r && parts ? (
                <li key={x} className="rounded-xl border border-border bg-card p-3">
                  <Link href={chapterHref(r.bookId, r.chapter, r.verseStart)} className="text-sm font-semibold text-gold-highlight hover:underline">
                    {x}
                  </Link>
                  <p className="mt-0.5 line-clamp-4 font-serif text-[0.9375rem] text-muted-foreground">
                    <ScriptureText parts={parts} />
                  </p>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}

      {notes ? (
        <section aria-labelledby="notes-title" className="space-y-4 rounded-2xl border border-border bg-card p-4">
          {visibility === "preview" && (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/5 p-3 text-sm" role="note">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> Draft, awaiting theological review. Members don&rsquo;t see these notes until a reviewer approves the study.
            </p>
          )}
          <h2 id="notes-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Study notes (not Scripture)
          </h2>
          <div>
            <h3 className="font-semibold">Background</h3>
            <p className="mt-1 text-[0.9375rem]">{notes.context}</p>
          </div>
          <div>
            <h3 className="font-semibold">The passage</h3>
            <p className="mt-1 text-[0.9375rem]">{notes.explanation}</p>
          </div>
          <div>
            <h3 className="font-semibold">Themes</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[0.9375rem]">
              {notes.themes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Questions</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-[0.9375rem]">
              {notes.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="font-semibold">Living it out</h3>
            <p className="mt-1 text-[0.9375rem]">{notes.application}</p>
          </div>
          <div>
            <h3 className="font-semibold">Prayer</h3>
            <p className="mt-1 font-serif text-[0.9375rem] italic">{notes.prayer}</p>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-border bg-elevated/50 p-3 text-sm text-muted-foreground">
          {lesson.notes ? "Study notes for this lesson are being reviewed and will appear here once approved." : "Study notes for this lesson are still being written."} Read the passage slowly, and write down what you notice.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <StudyNotesForm study={study.slug} lesson={lesson.slug} initial={(progress?.notes as string | null) ?? ""} />
      </section>

      <div className="flex flex-wrap gap-2">
        <ActionButton action={toggleStudyLessonAction} fields={{ study: study.slug, lesson: lesson.slug, done: done ? "false" : "true" }} variant={done ? "ghost" : "default"} aria-pressed={done}>
          {done ? <CheckCircle2 className="text-gold" aria-hidden /> : <Circle aria-hidden />} {done ? "Lesson complete" : "Mark lesson complete"}
        </ActionButton>
        {next && (
          <Link href={`/faith/studies/${study.slug}/${next.slug}`} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold hover:border-gold-muted">
            Next: {next.title}
          </Link>
        )}
      </div>
    </div>
  );
}
