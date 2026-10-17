import Link from "next/link";
import { BookOpen, CheckCircle2, Circle, Cross, Flame, Lock, NotebookPen, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { FaithChallenge } from "@/components/faith/faith-challenge";
import { DisciplineGoalForm, JournalForm } from "@/components/faith/faith-forms";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { FAITH_MOTIVATIONS, SCRIPTURES, THEME_LABELS, TRANSLATION, scriptureForDate, type FaithTheme } from "@/data/content";
import { devotionalForDate } from "@/lib/domain/challenge";
import { addDays, isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { getChallengeState } from "@/server/services/challenge";
import { archiveDisciplineGoalAction, deleteJournalEntryAction, setFaithEnabledAction, toggleDisciplineCheckinAction } from "@/server/actions/faith";

export const metadata = { title: "Faith & Discipline" };

export default async function FaithPage({ searchParams }: { searchParams: Promise<{ theme?: string; edit?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();

  if (!profile.faith_enabled) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Optional" title="Faith & Discipline" />
        <section className="rounded-2xl border border-border bg-card p-6">
          <Cross className="size-8 text-gold" aria-hidden />
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Narrow Gate Fitness takes its name from Matthew 7:13–14. This optional section offers scripture on perseverance, humility, discipline,
            self-control and stewardship, a private reflection journal, discipline goals and devotionals from a Christian perspective. It is entirely
            optional — none of it is required for training, and it never appears in your workouts or AI coach unless you bring it up.
          </p>
          <div className="mt-6">
          <ActionButton action={setFaithEnabledAction} fields={{ enabled: "true" }}>
Turn on Faith &amp; Discipline
          </ActionButton>
          </div>
        </section>
      </div>
    );
  }

  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const verse = scriptureForDate(today);
  const motivation = FAITH_MOTIVATIONS[new Date(`${today}T00:00:00Z`).getUTCDate() % FAITH_MOTIVATIONS.length];
  const theme = sp.theme && sp.theme in THEME_LABELS ? (sp.theme as FaithTheme) : null;
  const scriptures = theme ? SCRIPTURES.filter((s) => s.themes.includes(theme)) : SCRIPTURES;

  const [journalRes, goalsRes, checkinsRes, devotionalsRes, challenge] = await Promise.all([
    supabase.from("faith_journal_entries").select("id, entry_date, theme, scripture_ref, title, body").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(20),
    supabase.from("discipline_goals").select("id, title, cadence").eq("user_id", user.id).eq("is_active", true).order("created_at"),
    supabase.from("discipline_checkins").select("goal_id, checked_on").eq("user_id", user.id).gte("checked_on", addDays(today, -60)),
    supabase.from("content_items").select("id, title, body, scripture_ref").eq("kind", "devotional").eq("is_published", true).order("published_at", { ascending: false }).limit(6),
    getChallengeState(supabase, user.id, profile.timezone),
  ]);
  const journal = journalRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const checkins = checkinsRes.data ?? [];
  const editing = sp.edit ? journal.find((j) => j.id === sp.edit) : undefined;

  const goalStatus = (g: { id: string; cadence: string }) => {
    const set = new Set(checkins.filter((c) => c.goal_id === g.id).map((c) => c.checked_on as string));
    const step = g.cadence === "weekly" ? 7 : 1;
    let cursor = g.cadence === "weekly" ? startOfWeek(today) : today;
    const done = set.has(cursor);
    if (!done) cursor = addDays(cursor, -step);
    let streak = 0;
    while (set.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -step);
    }
    return { done, streak };
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Optional" title="Faith & Discipline" description="Rooted in faith. Built for strength." />

      <section className="bg-card-gradient relative overflow-hidden rounded-3xl border border-gold-muted/50 p-6 md:p-8" aria-labelledby="verse-title">
        <p id="verse-title" className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          Verse of the day
        </p>
        <blockquote className="mt-3 font-display text-2xl font-medium leading-snug md:text-3xl">&ldquo;{verse.text}&rdquo;</blockquote>
        <p className="mt-3 text-sm text-muted-foreground">
          {verse.reference} · {TRANSLATION.name} ({TRANSLATION.license})
        </p>
        <p className="mt-4 max-w-2xl text-sm text-foreground/85">
          <strong className="text-gold-highlight">Reflect:</strong> {verse.reflection}
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Flame className="size-4 text-gold" aria-hidden /> {motivation}
        </p>
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
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="discipline-title">
          <h2 id="discipline-title" className="mb-1 font-display text-xl font-bold uppercase">
            Discipline goals
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">Small, faithful habits — check them off as you go.</p>
          {goals.length ? (
            <ul className="mb-4 space-y-2">
              {goals.map((g) => {
                const s = goalStatus(g as { id: string; cadence: string });
                return (
                  <li key={g.id as string} className="flex items-center gap-3 rounded-xl bg-elevated/60 px-3 py-2">
                    <ActionButton
                      action={toggleDisciplineCheckinAction}
                      fields={{ goalId: g.id as string }}
                      variant="ghost"
                      size="icon"
                      aria-pressed={s.done}
                      aria-label={`${s.done ? "Uncheck" : "Check off"} ${g.title as string} for ${g.cadence === "weekly" ? "this week" : "today"}`}
                      className="text-gold"
                    >
                      {s.done ? <CheckCircle2 className="size-6" /> : <Circle className="size-6 text-muted-foreground" />}
                    </ActionButton>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-semibold", s.done && "text-gold-highlight")}>{g.title as string}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.cadence === "weekly" ? "Weekly" : "Daily"} · {s.streak} {g.cadence === "weekly" ? "week" : "day"} streak
                      </p>
                    </div>
                    <ActionButton action={archiveDisciplineGoalAction} fields={{ goalId: g.id as string }} variant="ghost" size="icon-sm" aria-label={`Remove ${g.title as string}`}>
<Trash2 aria-hidden />
                    </ActionButton>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">No discipline goals yet.</p>
          )}
          <DisciplineGoalForm />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="journal-new">
          <h2 id="journal-new" className="mb-1 flex items-center gap-2 font-display text-xl font-bold uppercase">
            <NotebookPen className="size-5 text-gold" aria-hidden /> {editing ? "Edit reflection" : "Reflection journal"}
          </h2>
          <p className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden /> Private to you — never visible to administrators or the AI coach.
          </p>
          <JournalForm
            today={today}
            defaultRef={verse.reference}
            entry={editing ? (editing as { id: string; entry_date: string; theme: string | null; scripture_ref: string | null; title: string | null; body: string }) : undefined}
          />
          {editing && (
            <Link href="/faith" className="mt-2 inline-block text-xs text-gold-highlight hover:underline">
              Cancel editing
            </Link>
          )}
        </section>
      </div>

      {journal.length > 0 && (
        <section aria-labelledby="entries-title">
          <h2 id="entries-title" className="mb-3 font-display text-xl font-bold uppercase">
            Past reflections
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {journal.map((j) => (
              <li key={j.id as string} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{(j.title as string) || (j.entry_date as string)}</p>
                    <p className="text-xs text-muted-foreground">
                      {j.entry_date as string}
                      {j.theme ? ` · ${THEME_LABELS[j.theme as FaithTheme]}` : ""}
                      {j.scripture_ref ? ` · ${j.scripture_ref as string}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/faith?edit=${j.id}#journal-new`}>Edit</Link>
                    </Button>
                    <ActionButton action={deleteJournalEntryAction} fields={{ id: j.id as string }} variant="ghost" size="icon-sm" aria-label="Delete entry">
<Trash2 aria-hidden />
                    </ActionButton>
                  </div>
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{j.body as string}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="scripture-title">
        <h2 id="scripture-title" className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase">
          <BookOpen className="size-5 text-gold" aria-hidden /> Scripture by theme
        </h2>
        <nav aria-label="Themes" className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          <Link href="/faith#scripture-title" aria-current={!theme ? "page" : undefined} className={cn("shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold", !theme ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}>
            All
          </Link>
          {(Object.keys(THEME_LABELS) as (FaithTheme | "other")[])
            .filter((t) => t !== "other")
            .map((t) => (
              <Link
                key={t}
                href={`/faith?theme=${t}#scripture-title`}
                aria-current={theme === t ? "page" : undefined}
                className={cn("shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold", theme === t ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}
              >
                {THEME_LABELS[t]}
              </Link>
            ))}
        </nav>
        <ul className="grid gap-3 md:grid-cols-2">
          {scriptures.map((s) => (
            <li key={s.reference} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm italic">&ldquo;{s.text}&rdquo;</p>
              <p className="mt-2 text-xs font-semibold text-gold">{s.reference} (KJV)</p>
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

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Prefer to hide this section? You can turn it back on any time from your profile.</p>
        <div className="mt-3">
        <ActionButton action={setFaithEnabledAction} fields={{ enabled: "false" }} variant="secondary">
Hide Faith &amp; Discipline
        </ActionButton>
        </div>
      </section>
    </div>
  );
}
