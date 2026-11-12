import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-md border border-border bg-elevated px-3.5 py-2 text-base text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-md border border-border bg-elevated px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full appearance-none rounded-md border border-border bg-elevated bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat px-3.5 pr-9 text-base text-foreground focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 md:text-sm",
      "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23C9A54C' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")]",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";
