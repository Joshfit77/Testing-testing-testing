import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { setDemoPlanAction } from "@/server/actions/demo";

/** Shown on every screen of a demo deployment: what's sample data, and the server-held Free/Pro switch. */
export function DemoBar({ plan, canSwitch, aiSimulated }: { plan: "free" | "pro" | "plus"; canSwitch: boolean; aiSimulated: boolean }) {
  return (
    <div
      role="note"
      data-testid="demo-bar"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold-muted/60 bg-gold/5 px-3 py-2 text-xs text-muted-foreground"
    >
      <p className="flex items-center gap-1.5">
        <FlaskConical className="size-3.5 shrink-0 text-gold" aria-hidden />
        <span>
          <span className="font-semibold text-foreground">Demo</span> · sample data · purchases off, nothing is charged{aiSimulated && " · AI replies simulated"}
        </span>
      </p>
      {canSwitch && (
        <form action={setDemoPlanAction} className="flex items-center gap-1" aria-label="Demo membership">
          <span className="mr-1">View as</span>
          {(["free", "pro"] as const).map((p) => (
            <button
              key={p}
              type="submit"
              name="plan"
              value={p}
              aria-pressed={plan === p}
              data-testid={`demo-plan-${p}`}
              className={cn(
                "rounded-full border px-2.5 py-1 font-semibold transition-colors",
                plan === p ? "border-gold bg-gold text-black" : "border-border text-foreground hover:border-gold-muted",
              )}
            >
              {p === "free" ? "Free" : "Pro"}
            </button>
          ))}
        </form>
      )}
    </div>
  );
}
