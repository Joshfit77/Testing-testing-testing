import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, label }: { value: number; className?: string; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} className={cn("h-2 w-full overflow-hidden rounded-full bg-elevated", className)}>
      <div className="h-full rounded-full bg-gold-gradient transition-[width] duration-700" style={{ width: `${v}%` }} />
    </div>
  );
}
