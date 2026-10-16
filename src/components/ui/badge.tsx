import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide", {
  variants: {
    variant: {
      default: "bg-gold/15 text-gold-highlight border border-gold-muted/50",
      secondary: "bg-elevated text-muted-foreground border border-border",
      success: "bg-success/15 text-[#5fc49a] border border-success/40",
      destructive: "bg-destructive/15 text-[#f08a8a] border border-destructive/40",
      outline: "border border-border text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
