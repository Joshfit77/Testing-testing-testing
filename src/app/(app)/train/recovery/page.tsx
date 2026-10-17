import Link from "next/link";
import { ArrowLeft, Clock, HeartPulse, Leaf, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { CheckinForm } from "@/components/recovery/checkin-form";
import { Button } from "@/components/ui/button";
import { EXERCISE_MODIFICATIONS, REST_DAY_ACTIVITIES } from "@/data/content";
import { STANDARD_COOLDOWN, STANDARD_WARMUP } from "@/data/programs";
import { readinessBand, readinessNote } from "@/lib/domain/readiness";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Recovery & mobility" };

const ROUTINES = [
  { slug: "daily-mobility-flow", title: "Daily Mobility Flow", body: "Four 15–20 minute routines for hips, spine, shoulders and ankles." },
  { slug: "recovery-deload-week", title: "Recovery & Deload Week", body: "A planned easy week of light lifting, easy cardio and mobility." },
  { slug: "active-aging-low-impact", title: "Low-Impact Strength & Balance", body: "Joint-friendly sessions you can do next to a sturdy support." },
];

export default async function RecoveryPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data: checkins } = await supabase
    .from("recovery_checkins")
    .select("checked_on, readiness_score, sleep_quality, energy, soreness, stress")
    .eq("user_id", user.id)
    .order("checked_on", { ascending: false })
    .limit(7);
  const latest = checkins?.[0];
  const band = latest ? readinessBand(latest.readiness_score as number) : null;

  return (
    <div className="space-y-6">
      <Link href="/train" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Train
      </Link>
      <PageHeader
        eyebrow="Recovery"
        title="Recovery & mobility"
        description="Check in on how you feel, then choose the right amount of training. Guidance here is general and not medical treatment."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="checkin-title">
          <h2 id="checkin-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
            <HeartPulse className="size-5 text-gold" aria-hidden /> Daily check-in
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">Takes 20 seconds. One check-in per day — submitting again updates today&apos;s.</p>
          <CheckinForm needsConsent={!profile.wellness_consent_at} />
        </section>

        <div className="space-y-4">
          <section className="bg-card-gradient rounded-2xl border border-border p-5" aria-labelledby="readiness-title">
            <h2 id="readiness-title" className="font-display text-xl font-bold uppercase">
              Training readiness
            </h2>
            {latest && band ? (
              <>
                <p className="mt-2">
                  <span className="font-display text-5xl font-bold text-gold-highlight">{latest.readiness_score as number}</span>
                  <span className="text-muted-foreground"> / 100 · {latest.checked_on as string}</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{readinessNote(band)}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No check-ins yet. Your readiness note will appear here.</p>
            )}
            {checkins && checkins.length > 1 && (
              <ul className="mt-4 flex gap-2" aria-label="Recent readiness scores">
                {[...checkins].reverse().map((c) => (
                  <li key={c.checked_on as string} className="flex-1 rounded-lg bg-elevated/60 px-1 py-2 text-center">
                    <span className="block font-display text-lg font-semibold">{c.readiness_score as number}</span>
                    <span className="block text-[10px] text-muted-foreground">{(c.checked_on as string).slice(5)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="routines-title">
            <h2 id="routines-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
              <Leaf className="size-5 text-gold" aria-hidden /> Mobility & low-impact routines
            </h2>
            <ul className="mt-3 space-y-2">
              {ROUTINES.map((r) => (
                <li key={r.slug}>
                  <Link href={`/train/programs/${r.slug}`} className="block rounded-xl border border-border bg-elevated/50 p-3 hover:border-gold-muted">
                    <span className="font-semibold">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">{r.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section aria-labelledby="rest-title">
        <h2 id="rest-title" className="mb-3 font-display text-xl font-bold uppercase">
          Rest-day activities
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {REST_DAY_ACTIVITIES.map((a) => (
            <li key={a.title} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-semibold">{a.title}</p>
              {a.minutes > 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-gold">
                  <Clock className="size-3" aria-hidden /> {a.minutes} min
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{a.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="warmup-title">
          <h2 id="warmup-title" className="font-display text-lg font-semibold uppercase">
            General warm-up
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {STANDARD_WARMUP.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ol>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="cooldown-title">
          <h2 id="cooldown-title" className="font-display text-lg font-semibold uppercase">
            General cooldown
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {STANDARD_COOLDOWN.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ol>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="mods-title">
        <h2 id="mods-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
          <ShieldAlert className="size-5 text-gold" aria-hidden /> Exercise modifications
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          You can skip any exercise that causes pain — the workout logger has a &ldquo;Causes pain&rdquo; skip option. These suggestions are not a
          rehabilitation plan.
        </p>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          {EXERCISE_MODIFICATIONS.map((m) => (
            <div key={m.situation} className="rounded-xl bg-elevated/50 p-4">
              <dt className="font-semibold">{m.situation}</dt>
              <dd>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {m.options.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex justify-center">
        <Button asChild variant="secondary">
          <Link href="/train/workout?blank=1">Log a recovery session</Link>
        </Button>
      </div>
    </div>
  );
}
