import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { bookBySlug, chapterHref, chapterLabel } from "@/lib/bible/books";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { chapterWords } from "@/server/bible/text";
import { READING_WPM } from "@/lib/bible/plans";

export async function generateMetadata({ params }: { params: Promise<{ book: string }> }) {
  const book = bookBySlug((await params).book);
  return { title: book ? `${book.name} (BSB)` : "Bible" };
}

export default async function BookPage({ params }: { params: Promise<{ book: string }> }) {
  const book = bookBySlug((await params).book);
  if (!book) notFound();
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("bible_reading_history").select("chapter").eq("user_id", user.id).eq("book_id", book.id).limit(1000);
  const read = new Set((data ?? []).map((r) => r.chapter as number));
  const minutes = Math.max(1, Math.round(Array.from({ length: book.chapters }, (_, i) => chapterWords(book.id, i + 1)).reduce((a, b) => a + b, 0) / READING_WPM));

  return (
    <div className="space-y-4">
      <BackLink href="/faith/bible">Bible</BackLink>
      <PageHeader
        eyebrow={book.testament === "OT" ? "Old Testament" : "New Testament"}
        title={book.name}
        description={`${book.chapters} chapter${book.chapters === 1 ? "" : "s"} · about ${minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 6) / 10} hours`} to read${read.size ? ` · you have opened ${read.size}` : ""}`}
        className="mb-2"
      />
      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10" aria-label={`Chapters of ${book.name}`}>
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
          <li key={c}>
            <Link
              href={chapterHref(book, c)}
              aria-label={`${chapterLabel(book, c)}${read.has(c) ? ", opened before" : ""}`}
              className={cn(
                "relative flex aspect-square min-h-12 items-center justify-center rounded-xl border text-base font-semibold tabular-nums hover:border-gold-muted",
                read.has(c) ? "border-gold-muted bg-gold/10 text-gold-highlight" : "border-border bg-card",
              )}
            >
              {c}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
