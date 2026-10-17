import Link from "next/link";

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/exercises", "Exercises"],
  ["/admin/programs", "Programs"],
  ["/admin/categories", "Categories"],
  ["/admin/content", "Content"],
  ["/admin/subscriptions", "Subscriptions"],
  ["/admin/flags", "Feature flags"],
] as const;

export function AdminNav({ current }: { current: string }) {
  return (
    <nav aria-label="Admin" className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={
            current === href
              ? "shrink-0 rounded-full border border-gold bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold-highlight"
              : "shrink-0 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
