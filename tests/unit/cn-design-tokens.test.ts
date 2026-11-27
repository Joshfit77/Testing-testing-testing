import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * `text-body` is the design system's 15 px size (globals.css). The class merger must treat it as a size: taken for a
 * colour, it was dropped beside a colour class and every button label grew to 16 px, which pushed two screens wider
 * than a 375 px phone at the largest text size.
 */
describe("class merging and the design tokens", () => {
  it("keeps the body size beside a text colour, and lets a later size replace it", () => {
    expect(cn("text-body", "text-primary-foreground")).toBe("text-body text-primary-foreground");
    expect(cn("text-primary-foreground", "text-body")).toBe("text-primary-foreground text-body");
    expect(cn("text-body", "text-sm")).toBe("text-sm");
    expect(cn("text-sm", "text-body")).toBe("text-body");
  });

  it("every button variant keeps its size class", () => {
    for (const variant of ["default", "secondary", "outline", "ghost", "destructive", "link"] as const) {
      expect(cn(buttonVariants({ variant })), variant).toMatch(/\btext-body\b/);
    }
    expect(cn(buttonVariants({ size: "lg" }))).toMatch(/\btext-base\b/);
    expect(cn(buttonVariants({ size: "lg" }))).not.toMatch(/\btext-body\b/);
  });
});
