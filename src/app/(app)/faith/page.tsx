import Link from "next/link";
import { BellRing, BookMarked, BookOpen, Brain, ChevronRight, Flame, GraduationCap, MessageCircleQuestion, NotebookPen, Route, Search, Sparkles, SlidersHorizontal } from "lucide-react";
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
import { parseLayoutPrefs, type FaithSection } from "@/lib/layout-prefs";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { getChallengeState } from "@/server/services/challenge";
import { JOURNAL_SELECT, loadFaithReminders, loadPractices, type JournalRow } from "@/server/services/faith";
import { ScriptureNotice } from "@/components/faith/scripture-notice";
import { TodayCard } from "@/components/faith/today-card";
import { chapterHref, chapterLabel } from "@/lib/bible/books";
import { loadDailyGoals } from "@/server/services/daily-goals";
import { loadActiveJourney } from "@/server/services/journeys";
import { loadReadingState } from "@/server/services/bible";
import { scriptureParts } from "@/server/bible/text";
import { ScriptureText } from "@/components/bible/scripture-text";
import { DEVOTIONALS } from "@/data/devotionals";
import { hasRedLetter, type TextPart } from "@/lib/bible/red-letter";

/** Red-letter parts of the 40 devotional verses that contain words of Jesus (the rest are shown plain). */
function devotionalRedLetter(): Record<number, TextPart[]> {
  const out: Record<number, TextPart[]> = {};
  for (const d of DEVOTIONALS) {
    const parts = scriptureParts(d.reference, d.scripture);
    if (hasRedLetter(parts)) out[d.day] = parts;
  }
  return out;
}

export const metadata = { title: "Faith" };

const card = "rounded-2xl border border-border bg-card";
const h2 = "text-lg font-semibold";
/** A folded section's title row: a full-width, 44 px tap target. */
const summary = "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-lg font-semibold [&::-webkit-details-marker]:hidden";

export default async function FaithPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();

  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const verse = scriptureForDate(today);
  const motivation = FAITH_MOTIVATIONS[new Date(`${today}T00:00:00Z`).getUTCDate() % FAITH_MOTIVATIONS.length];
  const theme = sp.theme && sp.theme in THEME_LABELS ? (sp.theme as FaithTheme) : null;
  const scriptures = theme ? SCRIPTURES.filter((s) => s.themes.includes(theme)) : SCRIPTURES;
  // Sections the member chose to hide (You → Customize Home). The quick actions and Bible tools are always there.
  const hidden = new Set<FaithSection>(parseLayoutPrefs(profile.layout_prefs).faith?.hidden ?? []);
  const show = (s: FaithSection) => !hidden.has(s);

  const [journalRes, journalCountRes, practiceData, devotionalsRes, challenge, reminders, journey, goals, reading] = await Promise.all([
    supabase.from("faith_journal_entries").select(JOURNAL_SELECT).eq("user_id", user.id).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(3),
    supabase.from("faith_journal_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    loadPractices(supabase, user.id, startOfWeek(addDays(today, -6))),
    supabase.from("content_items").select("id, title, body, scripture_ref").eq("kind", "devotional").eq("is_published", true).order("published_at", { ascending: false }).limit(6),
    getChallengeState(supabase, user.id, profile.timezone),
    loadFaithReminders(supabase, user.id),
    loadActiveJourney(supabase, user.id, profile.timezone),
    loadDailyGoals(supabase, user.id, profile.timezone),
    loadReadingState(supabase, user.id),
  ]);
  const tools = [
    { href: "/faith/bible", label: "Bible", icon: BookOpen },
    { href: "/faith/bible/search", label: "Search", icon: Search },
    { href: "/faith/bible/saved", label: "Saved", icon: BookMarked },
    { href: "/faith/journal", label: "Journal", icon: NotebookPen },
    { href: "/faith/journey", label: "Journey", icon: Route },
    { href: "/faith/memory", label: "Memorize", icon: Brain },
    { href: "/faith/studies", label: "Studies", icon: GraduationCap },
    { href: "/faith/ask", label: "Ask", icon: MessageCircleQuestion },
  ];
  const journal = (journalRes.data ?? []) as unknown as JournalRow[];
  const journalCount = journalCountRes.count ?? journal.length;
  const remindersOn = reminders.filter((r) => r.enabled);
  const readHref = reading ? chapterHref(reading.book, reading.chapter, reading.verse ?? undefined) : "/faith/bible";
  const quickAction = `${card} flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-sm font-semibold leading-tight hover:border-gold-muted`;

  return (
    <div className="space-y-4">
      <MainHeader title="Faith" />

      {/* The three things members open Faith for, on the first screen: read, today's devotional, pray. */}
      <nav aria-label="Faith quick actions" className="grid grid-cols-3 gap-2">
        <Link href={readHref} className={quickAction}>
          <BookOpen className="size-6 text-gold" aria-hidden />
          <span>{reading ? "Continue reading" : "Read the Bible"}</span>
          {reading && (
            <span className="block max-w-full truncate text-xs font-normal text-muted-foreground">
              {chapterLabel(reading.book, reading.chapter)}
              {reading.verse ? `:${reading.verse}` : ""}
            </span>
          )}
        </Link>
        {show("challenge") ? (
          <a href="#todays-devotional" className={quickAction}>
            <Sparkles className="size-6 text-gold" aria-hidden />
            <span>Today&apos;s devotional</span>
            <span className="block text-xs font-normal text-muted-foreground">Day {devotionalForDate(challenge.today).day} of 40</span>
          </a>
        ) : (
          <Link href="/faith/studies" className={quickAction}>
            <GraduationCap className="size-6 text-gold" aria-hidden />
            <span>Studies</span>
          </Link>
        )}
        <Link href="/faith/journal/new?kind=daily" className={quickAction}>
          <NotebookPen className="size-6 text-gold" aria-hidden />
          <span>Write a prayer</span>
          <span className="block text-xs font-normal text-muted-foreground">Private</span>
        </Link>
      </nav>

      {show("today") && <TodayCard userId={user.id} journey={journey} goals={goals} />}

      <nav aria-label="Bible tools" className="grid grid-cols-4 gap-2">
        {tools.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`${card} flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold hover:border-gold-muted`}>
            <Icon className="size-5 text-gold" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <section className={`relative overflow-hidden ${card}`} aria-labelledby="verse-title">
        {/* Decorative original artwork; the verse is the content. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/cross-dusk.svg" alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" aria-hidden />
        <div className="relative flex min-h-44 flex-col justify-end p-4 md:min-h-56 md:p-6">
          <h2 id="verse-title" className="text-xs font-semibold text-champagne/90">
            Verse of the day
          </h2>
          <p className="mt-1 max-w-[20rem] font-serif text-2xl leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]" aria-hidden>
            <ScriptureText parts={scriptureParts(verse.reference, verseExcerpt(verse.text))} />
          </p>
          <p className="mt-1.5 text-sm text-white/85">{verse.reference} ({TRANSLATION.code})</p>
        </div>
      </section>

      {show("challenge") && (
        <FaithChallenge
          today={challenge.today}
          rotatingDay={devotionalForDate(challenge.today).day}
          enrollment={challenge.active ? { id: challenge.active.id, startedOn: challenge.active.startedOn } : null}
          currentDay={challenge.currentDay}
          checkins={challenge.checkins}
          workoutDates={challenge.workoutDates}
          lastCompletedAt={challenge.lastCompleted?.completedAt ?? null}
          devotionalParts={devotionalRedLetter()}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {show("practices") && (
          <details className={`min-w-0 ${card}`} data-testid="faith-practices">
            <summary className={summary}>
              <span className="flex items-center gap-2">
                <Sparkles className="size-5 text-gold" aria-hidden /> Daily practices
              </span>
              <span className="text-sm font-normal text-muted-foreground">{practiceData.practices.length ? `${practiceData.practices.length} chosen` : "Choose a few"}</span>
            </summary>
            <section className="px-4 pb-4" aria-labelledby="practices-title">
              <h2 id="practices-title" className="sr-only">
                Daily practices
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">Small, faithful habits. Check them off as you go; nothing here is graded.</p>
              <PracticesPanel practices={practiceData.practices} checkins={practiceData.checkins} today={today} />
            </section>
          </details>
        )}

        {show("journal") && (
          <details className={`min-w-0 ${card}`} data-testid="faith-journal">
            <summary className={summary}>
              <span className="flex items-center gap-2">
                <NotebookPen className="size-5 text-gold" aria-hidden /> Prayer journal
              </span>
              <span className="text-sm font-normal text-muted-foreground">{journalCount ? `${journalCount} ${journalCount === 1 ? "entry" : "entries"}` : "Write here"}</span>
            </summary>
            <section className="px-4 pb-4" aria-labelledby="journal-new">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 id="journal-new" className="sr-only">
                  Prayer journal
                </h2>
                <p className="text-sm text-muted-foreground">Prayers, praise and reflections. Private by default.</p>
                <Link href="/faith/journal" className="inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-sm font-semibold text-gold-highlight hover:underline">
                  All entries{journalCount ? ` (${journalCount})` : ""} <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
              <JournalForm today={today} defaultRef={verse.reference} />
            </section>
          </details>
        )}
      </div>

      {show("journal") && journal.length > 0 && (
        <section aria-labelledby="entries-title">
          <h2 id="entries-title" className={`mb-2 ${h2}`}>
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

      <Link href="/profile/notifications#faith" className={`${card} flex min-h-14 items-center gap-3 px-4 py-3 hover:border-gold-muted`}>
        <BellRing className="size-5 shrink-0 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Faith reminders</span>
          <span className="block truncate text-sm text-muted-foreground">
            {remindersOn.length ? remindersOn.map((r) => `${FAITH_REMINDER_INFO[r.kind].label}: ${describeFaithReminder(r)}`).join(" · ") : "Off. Optional devotional, prayer and practice reminders."}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
      </Link>

      {/* More to read, folded so the daily things above stay on the first screens. Each opens with one tap. */}
      {show("reflection") && (
        <details className={card} aria-label="Today's verse in full">
          <summary className={summary}>
            <span className="flex items-center gap-2">
              <Flame className="size-5 text-gold" aria-hidden /> Today&apos;s verse, reflection and motivation
            </span>
            <ChevronRight className="size-4 shrink-0 text-gold transition-transform [details[open]_&]:rotate-90" aria-hidden />
          </summary>
          <div className="space-y-3 px-4 pb-4 text-[0.9375rem]">
            <blockquote className="font-serif text-lg leading-relaxed">
              &ldquo;
              <ScriptureText parts={scriptureParts(verse.reference, verse.text)} />
              &rdquo;
            </blockquote>
            <p className="text-sm text-muted-foreground">
              {verse.reference} · {TRANSLATION.name} ({TRANSLATION.license})
            </p>
            <p>
              <strong className="text-gold-highlight">Reflect:</strong> {verse.reflection}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Flame className="size-4 shrink-0 text-gold" aria-hidden /> {motivation}
            </p>
          </div>
        </details>
      )}

      {show("themes") && (
        <details className={card} open={Boolean(theme)}>
          <summary className={summary} id="scripture-title">
            <span className="flex items-center gap-2">
              <BookOpen className="size-5 text-gold" aria-hidden /> Scripture by theme
            </span>
            <ChevronRight className="size-4 shrink-0 text-gold transition-transform [details[open]_&]:rotate-90" aria-hidden />
          </summary>
          <section className="px-4 pb-4" aria-labelledby="scripture-title">
            {/* Every theme is a visible button; the row wraps rather than scrolling sideways. */}
            <nav aria-label="Themes" className="mb-4 flex flex-wrap gap-2">
              <Link href="/faith#scripture-title" aria-current={!theme ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", !theme ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}>
                All
              </Link>
              {(Object.keys(THEME_LABELS) as (FaithTheme | "other")[])
                .filter((t) => t !== "other")
                .map((t) => (
                  <Link
                    key={t}
                    href={`/faith?theme=${t}#scripture-title`}
                    aria-current={theme === t ? "page" : undefined}
                    className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", theme === t ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}
                  >
                    {THEME_LABELS[t]}
                  </Link>
                ))}
            </nav>
            <ul className="grid gap-3 md:grid-cols-2">
              {scriptures.map((s) => (
                <li key={s.reference} className="rounded-xl border border-border bg-elevated/40 p-4">
                  <p className="text-sm italic">
                    &ldquo;
                    <ScriptureText parts={scriptureParts(s.reference, s.text)} />
                    &rdquo;
                  </p>
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
        </details>
      )}

      {show("devotionals") && (
        <details className={card}>
          <summary className={summary} id="devotionals-title">
            <span className="flex items-center gap-2">
              <GraduationCap className="size-5 text-gold" aria-hidden /> Devotionals
            </span>
            <ChevronRight className="size-4 shrink-0 text-gold transition-transform [details[open]_&]:rotate-90" aria-hidden />
          </summary>
          <section className="px-4 pb-4" aria-labelledby="devotionals-title">
            {(devotionalsRes.data ?? []).length ? (
              <ul className="grid gap-3 md:grid-cols-3">
                {(devotionalsRes.data ?? []).map((d) => (
                  <li key={d.id as string} className="rounded-xl border border-border bg-elevated/40 p-4">
                    <p className="text-lg font-semibold">{d.title as string}</p>
                    {d.scripture_ref && <p className="text-xs text-gold">{d.scripture_ref as string}</p>}
                    <p className="mt-2 text-sm text-muted-foreground">{d.body as string}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No devotionals published yet" />
            )}
          </section>
        </details>
      )}

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Link href="/profile/customize" className="inline-flex min-h-11 items-center gap-1 font-semibold text-gold-highlight hover:underline">
          <SlidersHorizontal className="size-4" aria-hidden /> Customize this screen
        </Link>
        <span>Faith is always here in its own tab; the Scripture card on Home can be turned off in You.</span>
      </p>
      <ScriptureNotice />
    </div>
  );
}
