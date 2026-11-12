import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { bookById, chapterHref, chapterLabel } from "@/lib/bible/books";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Reading history" };

const LIMIT = 500;

export default async function ReadingHistoryPage() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("bible_reading_history").select("book_id, chapter, read_on, read_at").eq("user_id", user.id).order("read_on", { ascending: false }).order("read_at", { ascending: false }).limit(LIMIT),
    supabase.from("bible_reading_history").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const days = new Map<string, { bookId: string; chapter: number }[]>();
  for (const r of data ?? []) {
    const list = days.get(r.read_on as string) ?? [];
    list.push({ bookId: r.book_id as string, chapter: r.chapter as number });
    days.set(r.read_on as string, list);
  }

  return (
    <div className="space-y-4">
      <BackLink href="/faith/bible">Bible</BackLink>
      <PageHeader
        title="Reading history"
        description={`Chapters you have opened, by day${count ? ` (${count.toLocaleString("en-US")} in all)` : ""}. Opening a chapter is not the same as completing a journey's reading; that is marked on the journey.`}
        className="mb-2"
      />
      {days.size === 0 ? (
        <EmptyState title="Nothing read yet" description="Chapters you open appear here." />
      ) : (
        <ol className="space-y-4">
          {[...days.entries()].map(([day, list]) => (
            <li key={day}>
              <h2 className="mb-1.5 text-sm font-semibold text-muted-foreground">{new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</h2>
              <ul className="flex flex-wrap gap-2">
                {list.map((c) => {
                  const book = bookById(c.bookId)!;
                  return (
                    <li key={`${c.bookId}.${c.chapter}`}>
                      <Link href={chapterHref(book, c.chapter)} className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-gold-muted">
                        {chapterLabel(book, c.chapter)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
