import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { BadgeMedallion, TIER_LABEL } from "@/components/achievements/badge-icon";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { BADGE_CATEGORIES, badgePercent, computeAchievements, type BadgeState } from "@/lib/domain/achievements";
import { isoDateInTz } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import type { UnitSystem } from "@/lib/domain/types";
import { displayWeight, weightUnit } from "@/lib/domain/units";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { getAchievementStats } from "@/server/services/achievements";

export const metadata = { title: "Badges" };

const num = (n: number) => Math.floor(n).toLocaleString("en-US");

function formatProgress(b: BadgeState, units: UnitSystem): string {
  if (b.unit === "kg") return `${num(displayWeight(b.current, units, 0))} / ${num(displayWeight(b.target, units, 0))} ${weightUnit(units)}`;
  const suffix = b.unit === "weeks" ? " weeks" : b.unit === "days" ? " days" : "";
  return `${num(b.current)} / ${num(b.target)}${suffix}`;
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
          <p className={cn("font-semibold", !badge.earned && "text-muted-foreground")}>{badge.name}</p>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{TIER_LABEL[badge.tier]}</span>
        </div>
        <p className="text-sm text-muted-foreground">{badge.description}</p>
        {badge.earned && badge.earnedAt ? (
          <p className="mt-1 text-xs font-semibold text-gold-highlight">Earned {formatDate(badge.earnedAt)}</p>
        ) : (
          <div className="mt-2 space-y-1">
            <ProgressBar value={badgePercent(badge)} label={`${badge.name} progress`} />
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden /> {formatProgress(badge, units)}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

export default async function BadgesPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const plan = await getUserPlan(user.id);
  const tz = profile.timezone;
  const units = profile.unit_system;

  let badges: BadgeState[] | null = null;
  try {
    badges = computeAchievements(await getAchievementStats(supabase, user.id, tz), isoDateInTz(new Date(), tz));
  } catch (err) {
    logError("badges.load", err);
  }

  const back = (
    <Button asChild variant="ghost" size="sm">
      <Link href="/progress">
        <ArrowLeft aria-hidden /> Progress
      </Link>
    </Button>
  );

  if (!badges) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Progress" title="Badges" actions={back} />
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
        eyebrow="Progress"
        title="Badges"
        description="Earned from the training, eating and faithful habits you already log. Faithful in the small things."
        actions={back}
      />

      <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5" aria-label="Badge summary">
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
          .sort((a, b) => Number(b.earned) - Number(a.earned) || (a.earned && b.earned ? (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "") : 0));
        if (!list.length) return null;
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
            <h2 id={`cat-${cat.id}`} className="mb-3 font-display text-xl font-bold uppercase">
              {cat.label}
            </h2>
            {cat.id === "nutrition" && !hasFeature(plan, "nutrition_tracking") && (
              <p className="mb-3 text-xs text-muted-foreground">
                Food logging is included with Plus and Pro.{" "}
                <Link href="/profile/billing" className="text-gold-highlight underline">
                  See plans
                </Link>
              </p>
            )}
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
