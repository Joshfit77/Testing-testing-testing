"use client";

import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { QuickAddButton } from "./quick-add";
import { cn } from "@/lib/utils";
import { initials, useShellUser } from "./shell-context";

/**
 * Compact gold-outlined "AI Coach" pill: ~34px visual height, 44px touch target. `compact` always shows the short
 * "Coach" label (Home's header also carries the wordmark, so the long label would push the pill off a 393pt phone);
 * the accessible name stays "AI Coach" either way.
 */
export function CoachButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/coach"
      aria-label="AI Coach"
      className={cn(
        "group relative inline-flex h-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none",
        className,
      )}
    >
      <span className="inline-flex h-[2.125rem] items-center gap-1.5 rounded-full border border-gold/90 bg-black/30 px-3 text-sm font-semibold text-gold-highlight transition-colors group-hover:bg-gold/10 group-focus-visible:ring-2 group-focus-visible:ring-gold-highlight">
        <MessageCircle className="size-4" aria-hidden />
        {compact ? (
          <span>Coach</span>
        ) : (
          <>
            <span className="hidden @[22rem]:inline">AI Coach</span>
            <span className="@[22rem]:hidden">Coach</span>
          </>
        )}
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

/** Unified search: exercises, programs, foods, recipes, the Bible and settings in one place. */
export function SearchButton({ className }: { className?: string }) {
  return (
    <Link href="/search" aria-label="Search" className={cn("group inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none", className)}>
      <span className="flex size-[2.125rem] items-center justify-center rounded-full border border-border bg-black/30 text-foreground transition-colors group-hover:border-gold-muted group-focus-visible:ring-2 group-focus-visible:ring-gold-highlight">
        <Search className="size-4" aria-hidden />
      </span>
    </Link>
  );
}

/**
 * Header for every main screen (Home, Train, Nutrition, Faith, You and their main sub-screens): the title at left;
 * Search, Quick Add and the AI Coach at right. One row on phones (the You tab replaced the old avatar row, so the
 * header no longer spends a row on the logo and a profile link); desktop keeps the avatar for the sidebar layout.
 */
export function MainHeader({ title, subtitle, right, className }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  const { userId, today } = useShellUser();
  return (
    <header className={cn("mb-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 @container">
        <h1 className="min-w-0 flex-1 basis-[6.5rem] truncate font-display text-[1.625rem] font-bold leading-tight tracking-tight md:text-[1.75rem]">{title}</h1>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {right}
          <SearchButton />
          {userId && <QuickAddButton userId={userId} today={today} />}
          <CoachButton />
          <ProfileButton className="hidden md:inline-flex" />
        </div>
      </div>
      {subtitle && <div className="mt-0.5 text-[0.9375rem] text-muted-foreground">{subtitle}</div>}
    </header>
  );
}
