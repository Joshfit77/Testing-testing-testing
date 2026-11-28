import Link from "next/link";
import { Bookmark, CalendarDays, MessageSquareText } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { getServerSupabase } from "@/lib/supabase/server";
import { loadBiblicalAiAccess } from "@/server/biblical-ai-access";

export const metadata = { title: "Saved studies · Narrow Gate Biblical AI" };

/** The member's saved answers and personalized studies (bookmarked ones first when filtered). */
export default async function SavedStudiesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const access = await loadBiblicalAiAccess();
  const supabase = await getServerSupabase();
  let query = supabase.from("biblical_ai_saved_studies").select("id, kind, title, bookmarked, completed_days, content, updated_at").eq("user_id", access.user.id).order("updated_at", { ascending: false }).limit(200);
  if (sp.filter === "bookmarked") query = query.eq("bookmarked", true);
  if (sp.filter === "plans") query = query.eq("kind", "plan");
  const { data: rows } = await query;
  const tab = (f: string | undefined, label: string) => (
    <Link href={f ? `/faith/biblical-ai/saved?filter=${f}` : "/faith/biblical-ai/saved"} aria-current={sp.filter === f ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${sp.filter === f ? "border-gold bg-gold/15 text-gold-highlight" : "border-border text-muted-foreground"}`}>
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith/biblical-ai">Biblical AI</BackLink>
      <h1 className="font-display text-2xl font-bold">Saved studies</h1>
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {tab(undefined, "All")}
        {tab("bookmarked", "Bookmarked")}
        {tab("plans", "Personalized studies")}
      </nav>
      {!rows?.length ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nothing saved yet. Save an answer, or create a personalized study.</p>
      ) : (
        <ul className="space-y-2" data-testid="saved-studies">
          {rows.map((r) => {
            const plan = r.kind === "plan" ? (r.content as { plan?: { durationDays?: number } }).plan : null;
            const done = ((r.completed_days as number[]) ?? []).length;
            return (
              <li key={r.id as string}>
                <Link href={r.kind === "plan" ? `/faith/biblical-ai/studies/${r.id}` : `/faith/biblical-ai/saved/${r.id}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2 hover:border-gold-muted">
                  {r.kind === "plan" ? <CalendarDays className="size-5 shrink-0 text-gold" aria-hidden /> : <MessageSquareText className="size-5 shrink-0 text-gold" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title as string}</span>
                    <span className="block text-xs text-muted-foreground">{plan ? `${done} of ${plan.durationDays} days done` : `Saved ${new Date(r.updated_at as string).toLocaleDateString()}`}</span>
                  </span>
                  {r.bookmarked && <Bookmark className="size-4 fill-gold text-gold" aria-label="Bookmarked" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
