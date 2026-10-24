"use client";

import Link from "next/link";
import { clearAllDrafts } from "@/lib/drafts";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { Logo, LogoMark } from "@/components/common/logo";
import { cn } from "@/lib/utils";
import { MAIN_TABS, isActive, isTabActive, visibleSecondary } from "./nav-config";
import { ActiveWorkoutPill } from "./active-workout-pill";
import { NavigationProgress } from "./navigation-progress";
import { OfflineBanner } from "./offline-banner";
import { ShellUserProvider } from "./shell-context";
import { RESTORE_SCROLL_ATTR } from "./scroll-memory";
import { useTabHrefs } from "@/lib/nav-memory";

export type TextSize = "default" | "large" | "xlarge";

interface AppShellProps {
  children: React.ReactNode;
  userId: string;
  displayName: string;
  isAdmin: boolean;
  plan: string;
  textSize: TextSize;
  reduceMotion: boolean;
  signOutAction: () => Promise<void>;
}

const COLLAPSE_KEY = "ngf.sidebar.collapsed";

/** Apply display preferences to <html> and mirror them locally so the pre-paint script can restore them. */
export function applyDisplayPrefs(textSize: TextSize, reduceMotion: boolean) {
  const root = document.documentElement;
  if (textSize === "default") delete root.dataset.textSize;
  else root.dataset.textSize = textSize;
  if (reduceMotion) root.dataset.motion = "reduce";
  else delete root.dataset.motion;
  try {
    localStorage.setItem("ngf.textSize", textSize);
    localStorage.setItem("ngf.reduceMotion", reduceMotion ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

export function AppShell({ children, userId, displayName, isAdmin, plan, textSize, reduceMotion, signOutAction }: AppShellProps) {
  const pathname = usePathname();
  const secondary = visibleSecondary({ isAdmin });
  const [collapsed, setCollapsed] = useState(false);
  const shellUser = useMemo(() => ({ displayName, plan }), [displayName, plan]);
  // Tab links return to the last screen (and filters) used in that section this session (src/lib/nav-memory.ts).
  const tabHrefs = useTabHrefs(MAIN_TABS.map((t) => t.href));
  const restoreScroll = { [RESTORE_SCROLL_ATTR]: "" };

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => applyDisplayPrefs(textSize, reduceMotion), [textSize, reduceMotion]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const sideLink = (active: boolean) =>
    cn(
      "group flex h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold transition-colors",
      active ? "bg-gold/12 text-gold-highlight" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
      collapsed && "justify-center px-0",
    );

  return (
    <ShellUserProvider value={shellUser}>
      <div className="min-h-dvh bg-background">
        <NavigationProgress />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-black">
          Skip to content
        </a>

        {/* Desktop sidebar: the same five sections, then secondary links. */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-[#0b0b0b] transition-[width] duration-300 md:flex",
            collapsed ? "w-20" : "w-64",
          )}
        >
          <div className="flex h-20 items-center px-5">
            <Link href="/home" aria-label="Narrow Gate Fitness home">
              {collapsed ? <LogoMark /> : <Logo />}
            </Link>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main sections">
            {MAIN_TABS.map((item) => {
              const active = isTabActive(pathname, item);
              return (
                <Link key={item.href} href={tabHrefs[item.href] ?? item.href} {...restoreScroll} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} className={sideLink(active)}>
                  <item.icon className={cn("size-5 shrink-0", active && "text-gold")} aria-hidden />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
                  {active && !collapsed && <span className="ml-auto h-5 w-1 rounded-full bg-gold-gradient" aria-hidden />}
                </Link>
              );
            })}
            <div className="my-3 border-t border-border" role="presentation" />
            {secondary.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} className={sideLink(active)}>
                  <item.icon className={cn("size-5 shrink-0", active && "text-gold")} aria-hidden />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-2 border-t border-border p-3">
            {!collapsed && (
              <div className="rounded-xl bg-card px-3 py-2.5">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-gold">{plan} plan</p>
              </div>
            )}
            <form action={signOutAction} onSubmit={() => clearAllDrafts(userId)}>
              <button type="submit" className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground", collapsed && "justify-center px-0")}>
                <LogOut className="size-4" aria-hidden />
                {collapsed ? <span className="sr-only">Sign out</span> : "Sign out"}
              </button>
            </form>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-elevated", collapsed && "justify-center px-0")}
            >
              {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
              {!collapsed && "Collapse"}
            </button>
          </div>
        </aside>

        <div className={cn("transition-[padding] duration-300", collapsed ? "md:pl-20" : "md:pl-64")}>
          <OfflineBanner />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.25rem)] md:px-8 md:pb-12 md:pt-8">
            {children}
          </main>
        </div>

        <ActiveWorkoutPill userId={userId} />

        {/* Mobile bottom navigation: exactly five tabs, icon + label. */}
        <nav aria-label="Main sections" data-hide-with-keyboard className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#0b0b0b] md:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {MAIN_TABS.map((item) => {
              const active = isTabActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={tabHrefs[item.href] ?? item.href}
                    {...restoreScroll}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-16 min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap text-xs font-semibold transition-colors duration-200 active:scale-95",
                      active ? "text-gold-highlight" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className={cn("size-6 transition-colors", active && "text-gold")} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </ShellUserProvider>
  );
}
