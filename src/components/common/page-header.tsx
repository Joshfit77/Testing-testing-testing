import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 pt-2 md:flex-row md:items-end md:justify-between md:pt-0", className)}>
      <div className="animate-fade-up">
        {eyebrow && <p className="mb-1 text-sm font-semibold text-gold">{eyebrow}</p>}
        <h1 className="font-display text-[1.625rem] font-bold leading-tight tracking-tight md:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
