import { notFound } from "next/navigation";
import { BackLink } from "@/components/platform/back-link";
import { AnswerView } from "@/components/biblical-ai/answer-view";
import { SavedStudyControls } from "@/components/biblical-ai/saved-study-controls";
import type { ValidatedAnswer } from "@/lib/biblical-ai/answer";
import { getServerSupabase } from "@/lib/supabase/server";
import { loadBiblicalAiAccess } from "@/server/biblical-ai-access";
import { citedPassage } from "@/server/services/biblical-ai";

export const metadata = { title: "Saved study · Narrow Gate Biblical AI" };

/** One saved answer, with the member's own note and bookmark (RLS: only their own). */
export default async function SavedStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await loadBiblicalAiAccess();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("biblical_ai_saved_studies").select("id, kind, title, note, bookmarked, content").eq("id", id).maybeSingle();
  if (!data || data.kind !== "answer") notFound();
  const answer = (data.content as { answer: ValidatedAnswer }).answer;
  const passages = answer.scripture.map((s) => citedPassage(s.reference)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith/biblical-ai/saved">Saved studies</BackLink>
      <h1 className="font-display text-2xl font-bold">{data.title as string}</h1>
      <div className="rounded-2xl border border-border bg-card p-3">
        <AnswerView answer={answer} passages={passages} back={`/faith/biblical-ai/saved/${id}`} />
      </div>
      <SavedStudyControls id={id} note={(data.note as string | null) ?? ""} bookmarked={Boolean(data.bookmarked)} />
    </div>
  );
}
