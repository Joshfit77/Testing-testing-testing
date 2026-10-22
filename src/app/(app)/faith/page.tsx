import Link from "next/link";
import { BellRing, BookOpen, ChevronRight, Flame, NotebookPen, Sparkles } from "lucide-react";
import { MainHeader } from "@/components/shell/main-header";
import { EmptyState } from "@/components/common/states";
import { FaithChallenge } from "@/components/faith/faith-challenge";
import { JournalForm } from "@/components/faith/faith-forms";
import { JournalEntryCard } from "@/components/faith/journal-entry-card";
import { PracticesPanel } from "@/components/faith/practices-panel";
import { Badge } from "@/components/ui/badge";
import { FAITH_MOTIVATIONS, SCRIPTURES, THEME_LABELS, TRANSLATION, scriptureForDate, type FaithTheme } from "@/data/content";
import { devotionalForDate } from "@/lib/domain/challenge";
import { verseExcerpt } from "@/lib/domain/scripture";
import { addDays, isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import { describeFaithReminder, FAITH_REMINDER_INFO } from "@/lib/faith-reminders";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { getChallengeState } from "@/server/services/challenge";
import { JOURNAL_SELECT, loadFaithReminders, loadPractices, type JournalRow } from "@/server/services/faith";
import { ScriptureNotice } from "@/components/faith/scripture-notice";

export const metadata = { title: "Faith" };

export default async function FaithPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();

  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const verse = scriptureForDate(today);
  const motivation = FAITH_MOTIVATIONS[new Date(`${today}T00:00:00Z`).getUTCDate() % FAITH_MOTIVATIONS.length];
  const theme = sp.theme && sp.theme in THEME_LABELS ? (sp.theme as FaithTheme) : null;
  const scriptures = theme ? SCRIPTURES.filter((s) => s.themes.includes(theme)) : SCRIPTURES;

  const [journalRes, journalCountRes, practiceData, devotionalsRes, challenge, reminders] = await Promise.all([
    supabase.from("faith_journal_entries").select(JOURNAL_SELECT).eq("user_id", user.id).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(3),
    supabase.from("faith_journal_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    loadPractices(supabase, user.id, startOfWeek(addDays(today, -6))),
    supabase.from("content_items").select("id, title, body, scripture_ref").eq("kind", "devotional").eq("is_published", true).order("published_at", { ascending: false }).limit(6),
    getChallengeState(supabase, user.id, profile.timezone),
    loadFaithReminders(supabase, user.id),
  ]);
  const journal = (journalRes.data ?? []) as unknown as JournalRow[];
  const journalCount = journalCountRes.count ?? journal.length;
  const remindersOn = reminders.filter((r) => r.enabled);

  return (
    <div className="space-y-6">
      <MainHeader title="Faith" />

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="verse-title">
        {/* Decorative original artwork; the verse is the content. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/cross-dusk.svg" alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" aria-hidden />
        <div className="relative flex min-h-52 flex-col justify-end p-4 md:min-h-64 md:p-6">
          <h2 id="verse-title" className="text-xs font-semibold text-champagne/90">
            Verse of the day
          </h2>
          <p className="mt-1 max-w-[20rem] font-serif text-2xl leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]" aria-hidden>
            {verseExcerpt(verse.text)}
          </p>
          <p className="mt-1.5 text-sm text-white/85">{verse.reference} ({TRANSLATION.code})</p>
        </div>
      </section>
      <FaithChallenge
        today={challenge.today}
        rotatingDay={devotionalForDate(challenge.today).day}
        enrollment={challenge.active ? { id: challenge.active.id, startedOn: challenge.active.startedOn } : null}
        currentDay={challenge.currentDay}
        checkins={challenge.checkins}
        workoutDates={challenge.workoutDates}
        lastCompletedAt={challenge.lastCompleted?.completedAt ?? null}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4" aria-labelledby="practices-title">
          <h2 id="practices-title" className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-gold" aria-hidden /> Daily practices
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">Small, faithful habits. Check them off as you go; nothing here is graded.</p>
          <PracticesPanel practices={practiceData.practices} checkins={practiceData.checkins} today={today} />
        </section>

        <section className="min-w-0 rounded-2xl border border-border bg-card p-4" aria-labelledby="journal-new">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 id="journal-new" className="flex items-center gap-2 text-lg font-semibold">
              <NotebookPen className="size-5 text-gold" aria-hidden /> Prayer journal
            </h2>
            <Link href="/faith/journal" className="inline-flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-gold-highlight hover:underline">
              All entries{journalCount ? ` (${journalCount})` : ""} <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">Prayers, praise and reflections. Private by default.</p>
          <JournalForm today={today} defaultRef={verse.reference} />
        </section>
      </div>

      {journal.length > 0 && (
        <section aria-labelledby="entries-title">
          <h2 id="entries-title" className="mb-2 text-lg font-semibold">
            Recent entries
          </h2>
          <ul className="grid gap-2 md:grid-cols-3">
            {journal.map((j) => (
              <li key={j.id}>
                <JournalEntryCard entry={j} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/faith/reminders" className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
        <BellRing className="size-5 shrink-0 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Faith reminders</span>
          <span className="block truncate text-sm text-muted-foreground">
            {remindersOn.length ? remindersOn.map((r) => `${FAITH_REMINDER_INFO[r.kind].label}: ${describeFaithReminder(r)}`).join(" · ") : "Off. Optional devotional, prayer and practice reminders."}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
      </Link>

      <section className="rounded-2xl border border-border bg-card p-4 text-[0.9375rem]" aria-label="Today's verse in full">
        <blockquote className="font-serif text-lg leading-relaxed">&ldquo;{verse.text}&rdquo;</blockquote>
        <p className="mt-1 text-sm text-muted-foreground">
          {verse.reference} · {TRANSLATION.name} ({TRANSLATION.license})
        </p>
        <p className="mt-3">
          <strong className="text-gold-highlight">Reflect:</strong> {verse.reflection}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Flame className="size-4 shrink-0 text-gold" aria-hidden /> {motivation}
        </p>
      </section>

      <section aria-labelledby="scripture-title">
        <h2 id="scripture-title" className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase">
          <BookOpen className="size-5 text-gold" aria-hidden /> Scripture by theme
        </h2>
        <nav aria-label="Themes" className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          <Link href="/faith#scripture-title" aria-current={!theme ? "page" : undefined} className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold", !theme ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}>
            All
          </Link>
          {(Object.keys(THEME_LABELS) as (FaithTheme | "other")[])
            .filter((t) => t !== "other")
            .map((t) => (
              <Link
                key={t}
                href={`/faith?theme=${t}#scripture-title`}
                aria-current={theme === t ? "page" : undefined}
                className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold", theme === t ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}
              >
                {THEME_LABELS[t]}
              </Link>
            ))}
        </nav>
        <ul className="grid gap-3 md:grid-cols-2">
          {scriptures.map((s) => (
            <li key={s.reference} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm italic">&ldquo;{s.text}&rdquo;</p>
              <p className="mt-2 text-xs font-semibold text-gold">{s.reference} ({TRANSLATION.code})</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.themes.map((t) => (
                  <Badge key={t} variant="secondary">
                    {THEME_LABELS[t]}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="devotionals-title">
        <h2 id="devotionals-title" className="mb-3 font-display text-xl font-bold uppercase">
          Devotionals
        </h2>
        {(devotionalsRes.data ?? []).length ? (
          <ul className="grid gap-3 md:grid-cols-3">
            {(devotionalsRes.data ?? []).map((d) => (
              <li key={d.id as string} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-display text-lg font-semibold uppercase">{d.title as string}</p>
                {d.scripture_ref && <p className="text-xs text-gold">{d.scripture_ref as string}</p>}
                <p className="mt-2 text-sm text-muted-foreground">{d.body as string}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No devotionals published yet" />
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Faith is always here in its own tab. You can hide the Scripture card on Home in{" "}
        <Link href="/profile#display" className="font-semibold text-gold-highlight underline">
          Profile &amp; Settings
        </Link>
        .
      </p>
      <ScriptureNotice />
    </div>
  );
}
