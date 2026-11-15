import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design system's own font size (`text-body`, globals.css). Without this the merger takes it for a text colour
// and drops it next to one, so a button's label silently grows to the inherited size.
const twMerge = extendTailwindMerge({ extend: { theme: { text: ["body"] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
