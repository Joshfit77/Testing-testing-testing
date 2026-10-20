import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.625rem] text-[0.9375rem] font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-gold-gradient text-primary-foreground shadow-bronze hover:brightness-105",
        secondary: "bg-elevated text-foreground border border-border hover:border-gold-muted hover:bg-[#252525]",
        outline: "border border-gold/80 text-gold-highlight hover:bg-gold/10",
        ghost: "text-muted-foreground hover:bg-elevated hover:text-foreground",
        destructive: "bg-destructive text-white hover:brightness-110",
        link: "text-gold-highlight underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-11 px-5",
        // Compact visuals keep a 44px touch target through an invisible hit area.
        sm: "h-9 rounded-lg px-3 text-sm after:absolute after:-inset-1 after:content-['']",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9 rounded-lg after:absolute after:-inset-1 after:content-['']",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
