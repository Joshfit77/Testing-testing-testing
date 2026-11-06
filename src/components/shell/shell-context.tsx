"use client";

import { createContext, useContext } from "react";

export interface ShellUser {
  userId: string;
  displayName: string;
  plan: string;
  /** Today's date (YYYY-MM-DD) in the member's time zone, for Quick Add. */
  today: string;
}

const ShellUserContext = createContext<ShellUser>({ userId: "", displayName: "Athlete", plan: "", today: "" });

export const ShellUserProvider = ShellUserContext.Provider;

export function useShellUser(): ShellUser {
  return useContext(ShellUserContext);
}

/** One or two initials for the profile button. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}
