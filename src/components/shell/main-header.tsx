"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { LogoMark } from "@/components/common/logo";
import { cn } from "@/lib/utils";
import { initials, useShellUser } from "./shell-context";

/** Compact gold-outlined "AI Coach" pill: ~34px visual height, 44px touch target. */
export function CoachButton({ className }: { className?: string }) {
  return (
    <Link
      href="/coach"
      className={cn(
        "group relative inline-flex h-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none",
        className,
      )}
    >
      <span className="inline-flex h-[2.125rem] items-center gap-1.5 rounded-full border border-gold/90 bg-black/30 px-3 text-sm font-semibold text-gold-highlight transition-colors group-hover:bg-gold/10 group-focus-visible:ring-2 group-focus-visible:ring-gold-highlight">
        <MessageCircle className="size-4" aria-hidden />
        AI Coach
      </span>
    </Link>
  );
}

/** Circular initials avatar that opens Profile & Settings. */
export function ProfileButton({ className }: { className?: string }) {
  const { displayName } = useShellUser();
  return (
    <Link
      href="/profile"
      aria-label={`Profile and settings for ${displayName}`}
      className={cn("group relative inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none", className)}
    >
      <span className="flex size-9 items-center justify-center rounded-full border border-gold/70 bg-elevated text-[0.8125rem] font-bold text-champagne transition-colors group-hover:border-gold-highlight group-focus-visible:ring-2 group-focus-visible:ring-gold-highlight">
        {initials(displayName)}
      </span>
    </Link>
  );
}

/**
 * Header for every main screen (Home, Train, Run, Food, Faith and their main sub-screens):
 * title at left, then the AI Coach pill and the profile icon at right (SPEC §2).
 */
export function MainHeader({ title, subtitle, right, className }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("mb-5", className)}>
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Link href="/home" aria-label="Narrow Gate Fitness home" className="-ml-1 inline-flex size-11 items-center justify-center">
          <LogoMark className="size-8" />
        </Link>
        <ProfileButton className="-mr-1" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 font-display text-[1.625rem] font-bold leading-tight tracking-tight md:text-[1.75rem]">{title}</h1>
        <div className="flex shrink-0 items-center gap-1">
          {right}
          <CoachButton />
          <ProfileButton className="hidden md:inline-flex" />
        </div>
      </div>
      {subtitle && <div className="mt-0.5 text-[0.9375rem] text-muted-foreground">{subtitle}</div>}
    </header>
  );
}
