"use client";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gold data-[state=unchecked]:bg-elevated",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-lg transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
