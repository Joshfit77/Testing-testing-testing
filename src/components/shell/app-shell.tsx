"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, Ellipsis, LogOut } from "lucide-react";
import { Logo, LogoMark } from "@/components/common/logo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isActive, visibleNav } from "./nav-config";
import { ActiveWorkoutPill } from "./active-workout-pill";
import { NavigationProgress } from "./navigation-progress";
import { OfflineBanner } from "./offline-banner";

interface AppShellProps {
  children: React.ReactNode;
  userId: string;
  displayName: string;
  faithEnabled: boolean;
  isAdmin: boolean;
  plan: string;
  signOutAction: () => Promise<void>;
}

const COLLAPSE_KEY = "ngf.sidebar.collapsed";

export function AppShell({ children, userId, displayName, faithEnabled, isAdmin, plan, signOutAction }: AppShellProps) {
  const pathname = usePathname();
  const items = visibleNav({ faithEnabled, isAdmin });
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => setMoreOpen(false), [pathname]);

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

  const mobilePrimary = items.filter((i) => i.primaryMobile);
  const mobileMore = items.filter((i) => !i.primaryMobile);
  const moreActive = mobileMore.some((i) => isActive(pathname, i.href));

  return (
    <div className="min-h-dvh bg-background">
      <NavigationProgress />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-[#0d0d0d] transition-[width] duration-300 md:flex",
          collapsed ? "w-20" : "w-64",
        )}
        aria-label="Primary"
      >
        <div className="flex h-20 items-center px-5">
          <Link href="/home" aria-label="Narrow Gate Fitness home">
            {collapsed ? <LogoMark /> : <Logo />}
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                  active ? "bg-gold/12 text-gold-highlight" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className={cn("size-5 shrink-0", active && "text-gold")} aria-hidden />
                {!collapsed && <span>{item.label}</span>}
                {active && !collapsed && <span className="ml-auto h-5 w-1 rounded-full bg-gold-gradient" aria-hidden />}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          {!collapsed && (
            <div className="rounded-xl bg-card px-3 py-2.5">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-xs uppercase tracking-wider text-gold">{plan} plan</p>
            </div>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <LogOut className="size-4" aria-hidden />
              {!collapsed && "Sign out"}
              {collapsed && <span className="sr-only">Sign out</span>}
            </button>
          </form>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn("flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-elevated", collapsed && "justify-center px-0")}
          >
            {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="safe-top sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur-xl md:hidden">
        <Link href="/home" aria-label="Narrow Gate Fitness home">
          <Logo />
        </Link>
        <span className="rounded-full border border-gold-muted/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">{plan}</span>
      </header>

      <div className={cn("transition-[padding] duration-300", collapsed ? "md:pl-20" : "md:pl-64")}>
        <OfflineBanner />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 md:px-8 md:pb-12 md:pt-10">
          {children}
        </main>
      </div>

      <ActiveWorkoutPill userId={userId} />

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#0d0d0d]/95 backdrop-blur-xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {mobilePrimary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                    active ? "text-gold-highlight" : "text-muted-foreground",
                  )}
                >
                  <item.icon className={cn("size-5", active && "text-gold")} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                moreActive ? "text-gold-highlight" : "text-muted-foreground",
              )}
            >
              <Ellipsis className={cn("size-5", moreActive && "text-gold")} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent side="bottom">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
            <DialogDescription>Signed in as {displayName}</DialogDescription>
          </DialogHeader>
          <ul className="grid grid-cols-2 gap-2">
            {mobileMore.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-20 flex-col items-start justify-between rounded-2xl border p-3 text-sm font-semibold",
                      active ? "border-gold-muted bg-gold/10 text-gold-highlight" : "border-border bg-elevated",
                    )}
                  >
                    <item.icon className="size-5 text-gold" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <form action={signOutAction} className="mt-4">
            <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground">
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
