import { BookOpen, Dumbbell, Footprints, House, LineChart, Shield, UserRound, Utensils, Bot, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that belong to this tab (e.g. Progress lives under Home). */
  alsoMatches?: string[];
  requiresAdmin?: boolean;
}

/** The five main tabs, in this exact order, on every screen size (SPEC §2). */
export const MAIN_TABS: NavItem[] = [
  { href: "/home", label: "Home", icon: House, alsoMatches: ["/progress", "/calendar", "/plan"] },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/run", label: "Run", icon: Footprints },
  { href: "/nutrition", label: "Food", icon: Utensils },
  { href: "/faith", label: "Faith", icon: BookOpen },
];

/** Secondary destinations shown only in the desktop sidebar (mobile reaches them from the header or the tabs). */
export const SECONDARY_LINKS: NavItem[] = [
  { href: "/coach", label: "AI Coach", icon: Bot },
  { href: "/progress", label: "My Progress", icon: LineChart },
  { href: "/profile", label: "Profile & Settings", icon: UserRound },
  { href: "/admin", label: "Admin", icon: Shield, requiresAdmin: true },
];

export function visibleSecondary(opts: { isAdmin: boolean }): NavItem[] {
  return SECONDARY_LINKS.filter((i) => !i.requiresAdmin || opts.isAdmin);
}

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True when the main tab owns the current path. Every path maps to at most one tab. */
export function isTabActive(pathname: string, tab: Pick<NavItem, "href" | "alsoMatches">): boolean {
  return matches(pathname, tab.href) || (tab.alsoMatches ?? []).some((p) => matches(pathname, p));
}

/** Sidebar secondary links light up only on an exact section match. */
export function isActive(pathname: string, href: string): boolean {
  return matches(pathname, href);
}

/** The main tab that owns a path, or null (Coach, Profile, Admin belong to no tab). */
export function activeTab(pathname: string): NavItem | null {
  return MAIN_TABS.find((t) => isTabActive(pathname, t)) ?? null;
}
