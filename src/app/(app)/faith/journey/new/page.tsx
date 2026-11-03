import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { JourneyEnrollForm } from "@/components/faith/journey-enroll-form";
import { NEW_TESTAMENT, OLD_TESTAMENT } from "@/lib/bible/books";
import { MIN_VERSES_PER_DAY, PLAN_INFO, PLAN_KINDS, planTitle, TOPICS, type PlanKind } from "@/lib/bible/plans";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { journeyPlan, planOptions, validPlanSpec } from "@/server/bible/plans";
import { bibleMeta } from "@/server/bible/text";

export const metadata = { title: "Choose a journey" };

const step = "flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted";
const minutesLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`);

/**
 * Choosing a journey, one step per screen (links, so Back works): plan → book or topic → duration (each with its daily
 * load) → start date and the rule. Durations a plan is too short for aren't offered.
 */
export default async function NewJourneyPage({ searchParams }: { searchParams: Promise<{ kind?: string; param?: string; days?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const kind = sp.kind && (PLAN_KINDS as readonly string[]).includes(sp.kind) ? (sp.kind as PlanKind) : null;
  const needsParam = kind === "book" || kind === "topic";
  const spec = kind && (!needsParam || sp.param) ? validPlanSpec(kind, sp.param) : null;
  const days = Number(sp.days);
  const plan = spec && days ? journeyPlan(spec, days) : null;
  const href = (q: Record<string, string | undefined>) => `/faith/journey/new?${new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1])))}`;

  // Step 1: the plan.
  if (!kind) {
    return (
      <div className="space-y-4">
        <BackLink href="/faith/journey">Journey</BackLink>
        <PageHeader title="Choose a journey" description="What would you like to read? You'll choose how long to take next, and see how much reading each day holds." className="mb-2" />
        <ul className="space-y-2">
          {PLAN_KINDS.map((k) => (
            <li key={k}>
              <Link href={href({ kind: k })} className={step}>
                <span className="min-w-0">
                  <span className="block font-semibold">{PLAN_INFO[k].label}</span>
                  <span className="block text-sm text-muted-foreground">{PLAN_INFO[k].description}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Step 2: the book or the topic.
  if (needsParam && !spec) {
    const verses = new Map(bibleMeta().books.map((b) => [b.id, b.verses.reduce((n, v) => n + v, 0)]));
    const minVerses = 30 * MIN_VERSES_PER_DAY;
    return (
      <div className="space-y-4">
        <BackLink href="/faith/journey/new">Plans</BackLink>
        <PageHeader title={kind === "book" ? "Choose a book" : "Choose a topic"} className="mb-2" />
        {kind === "book" ? (
          [
            { label: "Old Testament", books: OLD_TESTAMENT },
            { label: "New Testament", books: NEW_TESTAMENT },
          ].map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-gold">{g.label}</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.books
                  .filter((b) => (verses.get(b.id) ?? 0) >= minVerses)
                  .map((b) => (
                    <li key={b.id}>
                      <Link href={href({ kind, param: b.id })} className="flex min-h-12 items-center rounded-xl border border-border bg-card px-3 font-semibold hover:border-gold-muted">
                        {b.name}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))
        ) : (
          <ul className="space-y-2">
            {Object.entries(TOPICS).map(([key, t]) => (
              <li key={key}>
                <Link href={href({ kind, param: key })} className={step}>
                  <span className="min-w-0">
                    <span className="block font-semibold">{t.label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {t.description} {t.passages.length} passages.
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {kind === "book" && <p className="text-sm text-muted-foreground">Very short books (such as Philemon and Jude) aren&rsquo;t listed: they have too few verses to spread over 30 days. You can read them any time in the Bible.</p>}
      </div>
    );
  }

  if (!spec) return null;
  const title = planTitle(spec);
  const backToPlan = needsParam ? href({ kind }) : "/faith/journey/new";

  // Step 3: the duration, with the daily load of each.
  if (!plan) {
    const options = planOptions(spec);
    return (
      <div className="space-y-4">
        <BackLink href={backToPlan}>{needsParam ? (kind === "book" ? "Books" : "Topics") : "Plans"}</BackLink>
        <PageHeader eyebrow="Choose a length" title={title} description="Each length shows the average reading time and number of chapters a day, and the longest day." className="mb-2" />
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.days}>
              <Link href={href({ kind, param: spec.param ?? undefined, days: String(o.days) })} className={step}>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-bold">{o.days} days</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-4 text-gold" aria-hidden /> about {minutesLabel(o.avgMinutes)} a day
                    </span>
                    <span>
                      {o.avgChapters < 1 ? "part of a chapter" : `${o.avgChapters} chapters`} a day
                    </span>
                    <span>longest day {minutesLabel(o.maxMinutes)}</span>
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        {options.length < 5 && <p className="text-sm text-muted-foreground">Longer lengths aren&rsquo;t offered for this plan: there wouldn&rsquo;t be enough reading for each day.</p>}
        <p className="text-sm text-muted-foreground">Times assume reading at about 200 words a minute.</p>
      </div>
    );
  }

  // Step 4: preview, start date and the rule.
  const today = isoDateInTz(new Date(), profile.timezone ?? "UTC");
  const supabase = await getServerSupabase();
  const { data: active } = await supabase.from("faith_journeys").select("plan_kind, plan_param, duration_days").eq("user_id", user.id).eq("status", "active").maybeSingle();
  const activeSpec = active ? validPlanSpec(active.plan_kind as string, active.plan_param as string | null) : null;
  const replacing = active ? `${activeSpec ? planTitle(activeSpec) : "Reading journey"}, ${active.duration_days} days` : null;

  return (
    <div className="space-y-4">
      <BackLink href={href({ kind, param: spec.param ?? undefined })}>Lengths</BackLink>
      <PageHeader eyebrow={`${days}-day journey`} title={title} description={`About ${minutesLabel(plan.avgMinutes)} a day (${plan.avgChapters < 1 ? "part of a chapter" : `${plan.avgChapters} chapters`}). ${plan.totalChapters.toLocaleString("en-US")} chapters' worth in all.`} className="mb-2" />
      <section aria-labelledby="preview-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="preview-title" className="mb-2 font-semibold">
          The first days
        </h2>
        <ol className="space-y-1.5">
          {plan.schedule.slice(0, 5).map((d) => (
            <li key={d.day} className={cn("flex items-baseline justify-between gap-3 text-[0.9375rem]")}>
              <span className="min-w-0">
                <span className="text-muted-foreground">Day {d.day}:</span> <span className="font-semibold">{d.label}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{d.minutes} min</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted-foreground">
          Last day (Day {days}): {plan.schedule.at(-1)!.label}
        </p>
      </section>
      <JourneyEnrollForm kind={spec.kind} param={spec.param ?? null} days={days} today={today} maxStart={addDays(today, 30)} replacing={replacing} />
    </div>
  );
}
