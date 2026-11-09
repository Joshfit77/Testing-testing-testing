import { BicepsFlexed, Bot, Cross, Footprints, House, LineChart, Shield, UserRound, Utensils, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that belong to this tab (e.g. Run lives under Train, My Progress under You). */
  alsoMatches?: string[];
  requiresAdmin?: boolean;
}

/**
 * The five main tabs, in this exact order, on every screen size: Home, Train, Nutrition, Faith, You.
 * Running and walking belong to Train (they are training); My Progress, the AI Coach's screen and settings belong
 * to You. The calendar and the plan screen belong to Home (they are about the member's week). Search belongs to no
 * tab: it is opened from every header, so lighting up Home there was wrong.
 */
export const MAIN_TABS: NavItem[] = [
  { href: "/home", label: "Home", icon: House, alsoMatches: ["/calendar", "/plan"] },
  { href: "/train", label: "Train", icon: BicepsFlexed, alsoMatches: ["/run"] },
  { href: "/nutrition", label: "Nutrition", icon: Utensils },
  { href: "/faith", label: "Faith", icon: Cross },
  { href: "/profile", label: "You", icon: UserRound, alsoMatches: ["/progress", "/coach"] },
];

/** Secondary destinations shown only in the desktop sidebar (phones reach them from the tabs and headers). */
export const SECONDARY_LINKS: NavItem[] = [
  { href: "/coach", label: "AI Coach", icon: Bot },
  { href: "/run", label: "Run", icon: Footprints },
  { href: "/progress", label: "My Progress", icon: LineChart },
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

/** The main tab that owns a path, or null (Admin belongs to no tab). */
export function activeTab(pathname: string): NavItem | null {
  return MAIN_TABS.find((t) => isTabActive(pathname, t)) ?? null;
}
