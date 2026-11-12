import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  className?: string;
  ariaLabel: string;
}

/** Gold gradient progress ring (SVG). */
export function ProgressRing({ value, size = 112, stroke = 10, label, sublabel, className, ariaLabel }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const gradientId = `ring-${ariaLabel.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${ariaLabel}: ${Math.round(clamped)}%`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F1DFA8" />
            <stop offset="60%" stopColor="#C9A54C" />
            <stop offset="100%" stopColor="#8C6A2F" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#262626" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label != null && <span className="font-display text-xl font-semibold leading-none">{label}</span>}
        {sublabel != null && <span className="mt-1 text-xs text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}
