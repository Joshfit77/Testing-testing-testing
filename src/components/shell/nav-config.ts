import { BookOpen, Bot, Cross, Dumbbell, House, LineChart, Shield, UserRound, Utensils, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar (max 6 + More). */
  primaryMobile?: boolean;
  requiresFaith?: boolean;
  requiresAdmin?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: House, primaryMobile: true },
  { href: "/train", label: "Programs", icon: Dumbbell, primaryMobile: true },
  { href: "/train/exercises", label: "Exercises", icon: BookOpen, primaryMobile: true },
  { href: "/nutrition", label: "Food", icon: Utensils, primaryMobile: true },
  { href: "/coach", label: "Coach", icon: Bot, primaryMobile: true },
  { href: "/progress", label: "Progress", icon: LineChart, primaryMobile: true },
  { href: "/faith", label: "Faith", icon: Cross, requiresFaith: true },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/admin", label: "Admin", icon: Shield, requiresAdmin: true },
];

export function visibleNav(opts: { faithEnabled: boolean; isAdmin: boolean }): NavItem[] {
  return NAV_ITEMS.filter((i) => (!i.requiresFaith || opts.faithEnabled) && (!i.requiresAdmin || opts.isAdmin));
}

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True when `href` is the most specific nav item matching the path (so /train/exercises lights up Exercises, not Programs). */
export function isActive(pathname: string, href: string, items: Pick<NavItem, "href">[] = NAV_ITEMS): boolean {
  if (!matches(pathname, href)) return false;
  return !items.some((i) => i.href !== href && i.href.length > href.length && matches(pathname, i.href));
}
