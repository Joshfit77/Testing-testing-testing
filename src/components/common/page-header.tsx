import { BackLink } from "@/components/platform/back-link";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** The parent screen: "← Label" above the title, the same on every detail screen (goes back in history when you came from there). */
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 pt-2 md:flex-row md:items-end md:justify-between md:pt-0", className)}>
      <div className="animate-fade-up">
        {back && (
          <BackLink href={back.href} className="-ml-1 mb-1">
            {back.label}
          </BackLink>
        )}
        {eyebrow && <p className="mb-1 text-sm font-semibold text-gold">{eyebrow}</p>}
        <h1 className="font-display text-[1.625rem] font-bold leading-tight tracking-tight md:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
