import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center", className)}>
      <div className="mb-3 rounded-2xl bg-gold/10 p-3 text-gold">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-semibold uppercase tracking-wide">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-8 text-center">
      <AlertTriangle className="mb-2 size-6 text-destructive" aria-hidden />
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "success" | "error"; children: React.ReactNode; className?: string }) {
  const styles = {
    info: "border-gold-muted/50 bg-gold/5 text-foreground",
    warning: "border-[#a8802f]/60 bg-[#a8802f]/10 text-foreground",
    success: "border-success/50 bg-success/10 text-foreground",
    error: "border-destructive/50 bg-destructive/10 text-foreground",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", styles, className)}>
      {children}
    </div>
  );
}
