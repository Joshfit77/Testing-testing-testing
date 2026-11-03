import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { MemoryPractice } from "@/components/faith/memory-practice";
import { formatReference } from "@/lib/bible/reference";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { passageText } from "@/server/bible/text";
import { memoryRef, type MemoryRow } from "@/lib/faith/memory";

export const metadata = { title: "Practise" };

export default async function MemoryPracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("scripture_memory").select("id, book_id, chapter, verse_start, verse_end, status, level, review_count, next_review_on").eq("id", id).eq("user_id", user.id).maybeSingle();
  const row = data as MemoryRow | null;
  const ref = row ? memoryRef(row) : null;
  const text = ref ? passageText(ref) : null;
  if (!row || !ref || !text) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith/memory">Scripture memory</BackLink>
      <PageHeader title={formatReference(ref)} description={`Practised ${row.review_count} time${row.review_count === 1 ? "" : "s"}${row.status === "memorized" ? " · memorized" : ""}.`} className="mb-2" />
      <MemoryPractice key={`${row.id}.${row.level}.${row.review_count}`} id={row.id} text={text} reference={formatReference(ref)} level={row.level} />
      <p className="text-xs text-muted-foreground">Berean Standard Bible (BSB), public domain.</p>
    </div>
  );
}
