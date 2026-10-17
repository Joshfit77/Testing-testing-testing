import {
  BookOpen,
  CalendarCheck,
  CalendarRange,
  Camera,
  CheckCheck,
  Crown,
  Dumbbell,
  Flag,
  Flame,
  Medal,
  NotebookPen,
  Salad,
  Scale,
  ShieldCheck,
  Sunrise,
  TrendingUp,
  Trophy,
  Utensils,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { BadgeIconName, BadgeTier } from "@/lib/domain/achievements";
import { cn } from "@/lib/utils";

const ICONS: Record<BadgeIconName, LucideIcon> = {
  BookOpen,
  CalendarCheck,
  CalendarRange,
  Camera,
  CheckCheck,
  Crown,
  Dumbbell,
  Flag,
  Flame,
  Medal,
  NotebookPen,
  Salad,
  Scale,
  ShieldCheck,
  Sunrise,
  TrendingUp,
  Trophy,
  Utensils,
  Weight,
  Zap,
};

const TIER_RING: Record<BadgeTier, string> = {
  bronze: "ring-[#a8723f]/70",
  silver: "ring-[#c9c9c9]/70",
  gold: "ring-gold-highlight",
};

export const TIER_LABEL: Record<BadgeTier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

/** Round medallion for a badge. Earned badges are gold; locked ones are greyed out. */
export function BadgeMedallion({ icon, tier, earned, className }: { icon: BadgeIconName; tier: BadgeTier; earned: boolean; className?: string }) {
  const Icon = ICONS[icon];
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-card",
        earned ? cn("bg-gold-gradient text-black", TIER_RING[tier]) : "bg-elevated text-muted-foreground/60 ring-border",
        className,
      )}
    >
      <Icon className="size-6" />
    </span>
  );
}
