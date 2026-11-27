import { CheckCircle2, Lock } from "lucide-react";
import { BadgeMedallion, TIER_LABEL } from "@/components/achievements/badge-icon";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { ProgressBar } from "@/components/ui/progress-bar";
import { BADGE_CATEGORIES, badgePercent, badgeRemaining, computeAchievements, type BadgeState } from "@/lib/domain/achievements";
import { isoDateInTz } from "@/lib/domain/dates";
import type { UnitSystem } from "@/lib/domain/types";
import { displayWeight, weightUnit } from "@/lib/domain/units";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { getAchievementStats } from "@/server/services/achievements";
import { RankBoard } from "@/components/badges/rank-board";
import { ACTIVE_TRANSLATION, BSB_PASSAGES } from "@/data/scripture";
import { scriptureParts } from "@/server/bible/text";
import { hasRedLetter } from "@/lib/bible/red-letter";
import { RANKS, allRankProgress, type CategoryProgress, type RankCategory } from "@/lib/domain/ranks";

export const metadata = { title: "Badges" };

const num = (n: number) => Math.floor(n).toLocaleString("en-US");

function formatProgress(b: BadgeState, units: UnitSystem): string {
  if (b.unit === "kg") return `${num(displayWeight(b.current, units, 0))} / ${num(displayWeight(b.target, units, 0))} ${weightUnit(units)}`;
  const suffix = b.unit === "weeks" ? " weeks" : b.unit === "days" ? " days" : b.counts ? ` ${b.counts[1]}` : "";
  return `${num(b.current)} / ${num(b.target)}${suffix}`;
}

/** "3 workouts remaining", "2 more weeks in a row", "12,400 lb to go". */
function formatRemaining(b: BadgeState, units: UnitSystem): string {
  const left = badgeRemaining(b);
  if (b.unit === "kg") return `${num(Math.ceil(displayWeight(left, units, 1)))} ${weightUnit(units)} to go`;
  if (b.unit === "weeks") return `${num(left)} more ${left === 1 ? "week" : "weeks"} in a row`;
  if (b.unit === "days") return `${num(left)} more ${left === 1 ? "day" : "days"}`;
  const noun = b.counts ? (left === 1 ? b.counts[0] : b.counts[1]) : "";
  return `${num(left)}${noun ? ` ${noun}` : ""} remaining`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

function BadgeCard({ badge, units }: { badge: BadgeState; units: UnitSystem }) {
  return (
    <li
      className={cn(
        "flex items-start gap-4 rounded-2xl border bg-card p-4",
        badge.earned ? "border-gold-muted shadow-[0_8px_24px_-16px_rgba(201,165,76,0.6)]" : "border-border",
      )}
    >
      <BadgeMedallion icon={badge.icon} tier={badge.tier} earned={badge.earned} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-semibold">{badge.name}</p>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{TIER_LABEL[badge.tier]}</span>
        </div>
        <p className="text-sm text-muted-foreground">{badge.description}</p>
        {badge.earned ? (
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-gold-highlight" data-testid="badge-unlocked">
            <CheckCircle2 className="size-3.5" aria-hidden /> Unlocked{badge.earnedAt ? ` · ${formatDate(badge.earnedAt)}` : ""}
          </p>
        ) : (
          <div className="mt-2 space-y-1" data-testid="badge-progress">
            <ProgressBar value={badgePercent(badge)} label={`${badge.name} progress`} />
            <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
              <span className="flex items-center gap-1">
                <Lock className="size-3" aria-hidden /> {formatProgress(badge, units)}
              </span>
              <span className="font-semibold text-gold-highlight">{Math.floor(badgePercent(badge))}%</span>
            </p>
            <p className="text-xs font-medium text-foreground">{formatRemaining(badge, units)}</p>
          </div>
        )}
      </div>
    </li>
  );
}

export default async function BadgesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const initialTab: RankCategory = sp.tab === "food" || sp.tab === "faith" ? sp.tab : "fitness";
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const tz = profile.timezone;
  const units = profile.unit_system;

  let badges: BadgeState[] | null = null;
  let ranks: CategoryProgress[] = [];
  const today = isoDateInTz(new Date(), tz);
  try {
    const stats = await getAchievementStats(supabase, user.id, tz);
    badges = computeAchievements(stats, today);
    // Every Fitness, Food and Faith rank is earnable on every plan.
    ranks = allRankProgress({ workoutDates: stats.workouts.map((w) => w.date), foodDays: stats.foodDays, faithDays: stats.faithDays });
  } catch (err) {
    logError("badges.load", err);
  }

  if (!badges) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ href: "/progress", label: "My Progress" }} eyebrow="Progress" title="Badges" />
        <ErrorState description="We couldn't load your badges right now. Please try again in a moment." />
      </div>
    );
  }

  const categories = BADGE_CATEGORIES;
  const visible = badges.filter((b) => categories.some((c) => c.id === b.category));
  const earned = visible.filter((b) => b.earned).length;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/progress", label: "My Progress" }}
        eyebrow="Progress"
        title="Badges"
        description="Earned from the training, eating and faithful habits you already log. Faithful in the small things."
      />

      <RankBoard
        progress={ranks}
        verses={Object.fromEntries(RANKS.map((r) => [r.reference, BSB_PASSAGES[r.reference] ?? ""]))}
        verseParts={Object.fromEntries(
          RANKS.map((r) => [r.reference, scriptureParts(r.reference, BSB_PASSAGES[r.reference] ?? "")] as const).filter(([, parts]) => hasRedLetter(parts)),
        )}
        translation={ACTIVE_TRANSLATION.code}
        initial={initialTab}
        today={today}
      />

      <h2 className="pt-2 font-display text-xl font-bold">More achievements</h2>

      <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5" aria-label="Achievement summary">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Earned</p>
          <p className="font-display text-3xl font-bold">
            {earned} <span className="text-lg text-muted-foreground">/ {visible.length}</span>
          </p>
        </div>
        <ProgressBar className="max-w-48 flex-1" value={(earned / Math.max(1, visible.length)) * 100} label="Badges earned" />
      </section>

      {categories.map((cat) => {
        const list = visible
          .filter((b) => b.category === cat.id)
          // Earned first (newest first), then the locked badges closest to being earned.
          .sort(
            (a, b) =>
              Number(b.earned) - Number(a.earned) ||
              (a.earned && b.earned ? (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "") : badgePercent(b) - badgePercent(a)),
          );
        if (!list.length) return null;
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
            <h3 id={`cat-${cat.id}`} className="mb-3 font-display text-lg font-bold">
              {cat.label}
            </h3>
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((b) => (
                <BadgeCard key={b.id} badge={b} units={units} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
