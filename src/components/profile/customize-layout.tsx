"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { FAITH_SECTION_LABELS, FAITH_SECTIONS, HOME_MODULE_LABELS, type FaithSection, type HomeModule, type LayoutPrefs } from "@/lib/layout-prefs";
import { cn } from "@/lib/utils";
import { updateUiPrefsAction } from "@/server/actions/ui-prefs";

/**
 * Customize Home and Faith: reorder or hide Home modules, hide Faith sections. The order shown starts from the
 * default for the member's goal (passed in), and every change is saved to the profile straight away, so it is the
 * same on every device. "Reset" goes back to the default for their goal.
 */
export function CustomizeLayout({ defaultOrder, prefs }: { defaultOrder: HomeModule[]; prefs: LayoutPrefs }) {
  const [order, setOrder] = useState<HomeModule[]>(() => {
    const chosen = prefs.home?.order ?? [];
    return [...chosen.filter((m) => defaultOrder.includes(m)), ...defaultOrder.filter((m) => !chosen.includes(m))];
  });
  const [hidden, setHidden] = useState<Set<HomeModule>>(() => new Set(prefs.home?.hidden ?? []));
  const [faithHidden, setFaithHidden] = useState<Set<FaithSection>>(() => new Set(prefs.faith?.hidden ?? []));
  const [pending, start] = useTransition();

  const save = (next: { order: HomeModule[]; hidden: Set<HomeModule>; faithHidden: Set<FaithSection> }) =>
    start(async () => {
      const res = await updateUiPrefsAction({ layout: { home: { order: next.order, hidden: [...next.hidden] }, faith: { hidden: [...next.faithHidden] } } });
      if (!res.ok) toast.error(res.message ?? "Couldn't save your layout.");
    });

  const move = (m: HomeModule, dir: -1 | 1) => {
    const i = order.indexOf(m);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
    save({ order: next, hidden, faithHidden });
  };
  const toggleHidden = (m: HomeModule) => {
    const next = new Set(hidden);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    setHidden(next);
    save({ order, hidden: next, faithHidden });
  };
  const toggleFaith = (s: FaithSection) => {
    const next = new Set(faithHidden);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setFaithHidden(next);
    save({ order, hidden, faithHidden: next });
  };
  const reset = () => {
    setOrder(defaultOrder);
    setHidden(new Set());
    setFaithHidden(new Set());
    start(async () => {
      const res = await updateUiPrefsAction({ layout: {} });
      if (!res.ok) toast.error(res.message ?? "Couldn't reset your layout.");
    });
  };

  return (
    <div className="space-y-5" aria-busy={pending} data-testid="customize-layout">
      <div>
        <p className="text-[0.9375rem] font-semibold">Home</p>
        <p className="mb-2 text-sm text-muted-foreground">Move what matters to you to the top, or hide what you don&apos;t use. Today&apos;s workout always stays.</p>
        <ol className="divide-y divide-border rounded-xl border border-border">
          {order.map((m, i) => {
            const off = hidden.has(m) && m !== "workout";
            return (
              <li key={m} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2", off && "opacity-60")}>
                <span className="min-w-[9rem] flex-1">
                  <span className="block text-[0.9375rem] font-semibold">{HOME_MODULE_LABELS[m].title}</span>
                  <span className="block text-sm text-muted-foreground">{HOME_MODULE_LABELS[m].body}</span>
                </span>
                <Button type="button" variant="ghost" size="icon" onClick={() => move(m, -1)} disabled={i === 0} aria-label={`Move ${HOME_MODULE_LABELS[m].title} up`}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => move(m, 1)} disabled={i === order.length - 1} aria-label={`Move ${HOME_MODULE_LABELS[m].title} down`}>
                  <ArrowDown aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => toggleHidden(m)} disabled={m === "workout"} aria-pressed={!off} aria-label={`${off ? "Show" : "Hide"} ${HOME_MODULE_LABELS[m].title} on Home`}>
                  {off ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <p className="text-[0.9375rem] font-semibold">Faith</p>
        <p className="mb-2 text-sm text-muted-foreground">Sections of the Faith tab. Bible reading, the journey and the quick actions are always there.</p>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {FAITH_SECTIONS.map((s) => (
            <li key={s} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
              <span id={`faith-section-${s}`} className="text-[0.9375rem]">
                {FAITH_SECTION_LABELS[s]}
              </span>
              <Switch checked={!faithHidden.has(s)} aria-labelledby={`faith-section-${s}`} onCheckedChange={() => toggleFaith(s)} />
            </li>
          ))}
        </ul>
      </div>
      <Button type="button" variant="secondary" className="h-auto w-full whitespace-normal" onClick={reset}>
        <RotateCcw aria-hidden /> Reset to the default for my goal
      </Button>
    </div>
  );
}
