"use client";

import { useActionState, useState } from "react";
import { Check, ChevronDown, Clock, TriangleAlert } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/common/form-status";
import { Badge } from "@/components/ui/badge";
import { initialActionState } from "@/lib/action-state";
import { DIET_TYPES, DIETS, type DietType } from "@/lib/domain/diets";
import { cn } from "@/lib/utils";
import { updateDietAction } from "@/server/actions/nutrition";

/** All diet styles with details; the user's current diet is highlighted and can be changed. */
export function DietPicker({ current }: { current: DietType | null }) {
  const [open, setOpen] = useState<DietType | null>(current);
  // One action state for the whole list, so the confirmation survives the re-render that moves "Your diet".
  const [state, action] = useActionState(updateDietAction, initialActionState);
  return (
    <>
      <FormMessage state={state} />
      <ul className="stagger grid gap-3 md:grid-cols-2">
        {DIET_TYPES.map((id) => {
          const d = DIETS[id];
          const isOpen = open === id;
          const isCurrent = current === id;
          return (
            <li
              key={id}
              className={cn(
                "lift rounded-2xl border bg-card",
                isCurrent ? "border-gold bg-card-gradient" : "border-border"
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : id)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <span>
                  <span className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide">
                    {d.name}
                    {isCurrent && (
                      <Badge>
                        <Check className="size-3" aria-hidden /> Your diet
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {d.tagline}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <div className="animate-fade-up space-y-3 px-4 pb-4 text-sm">
                  <p>{d.description}</p>
                  {d.eatingWindow && (
                    <p className="flex items-center gap-2 text-gold-highlight">
                      <Clock className="size-4" aria-hidden /> {d.eatingWindow}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gold">
                        Eat
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                        {d.eat.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gold">
                        Limit
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                        {d.limit.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gold">
                      A sample day
                    </p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {d.sampleDay.map((x) => (
                        <li key={x}>• {x}</li>
                      ))}
                    </ul>
                  </div>
                  {d.caution && (
                    <p className="flex gap-2 rounded-xl border border-[#6b5a2a] bg-gold/5 p-3 text-xs">
                      <TriangleAlert
                        className="mt-0.5 size-4 shrink-0 text-gold"
                        aria-hidden
                      />
                      {d.caution}
                    </p>
                  )}
                  {!isCurrent && (
                    <form action={action}>
                      <SubmitButton
                        size="sm"
                        name="diet"
                        value={id}
                        pendingLabel="Saving…"
                      >
                        Choose {d.name}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
