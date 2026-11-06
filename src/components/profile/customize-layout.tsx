"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import {
  FAITH_SECTION_LABELS,
  FAITH_SECTIONS,
  HOME_MODULE_LABELS,
  NUTRITION_SECTION_LABELS,
  NUTRITION_SECTIONS,
  TRAIN_SECTION_LABELS,
  TRAIN_SECTIONS,
  type FaithSection,
  type HomeModule,
  type LayoutPrefs,
  type NutritionSection,
  type SectionPrefs,
  type TrainSection,
} from "@/lib/layout-prefs";
import { cn } from "@/lib/utils";
import { updateUiPrefsAction } from "@/server/actions/ui-prefs";

type Labels<T extends string> = Record<T, { title: string; body: string }>;

/** One reorderable, hideable list (Home modules, Train sections, Nutrition sections). */
function SectionList<T extends string>({ order, hidden, labels, always, place, onMove, onToggle }: { order: T[]; hidden: Set<T>; labels: Labels<T>; always?: T; place: string; onMove: (m: T, dir: -1 | 1) => void; onToggle: (m: T) => void }) {
  return (
    <ol className="divide-y divide-border rounded-xl border border-border">
      {order.map((m, i) => {
        const off = hidden.has(m) && m !== always;
        return (
          <li key={m} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2", off && "opacity-60")}>
            <span className="min-w-[9rem] flex-1">
              <span className="block text-[0.9375rem] font-semibold">{labels[m].title}</span>
              <span className="block text-sm text-muted-foreground">{labels[m].body}</span>
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={() => onMove(m, -1)} disabled={i === 0} aria-label={`Move ${labels[m].title} up`}>
              <ArrowUp aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onMove(m, 1)} disabled={i === order.length - 1} aria-label={`Move ${labels[m].title} down`}>
              <ArrowDown aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onToggle(m)} disabled={m === always} aria-pressed={!off} aria-label={`${off ? "Show" : "Hide"} ${labels[m].title} on ${place}`}>
              {off ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

function startOrder<T extends string>(all: readonly T[], chosen: T[] | undefined): T[] {
  const c = chosen ?? [];
  return [...c.filter((m) => all.includes(m)), ...all.filter((m) => !c.includes(m))];
}

/**
 * Customize Home, Train, Nutrition and Faith: reorder or hide the sections of each tab. The Home order starts from the
 * default for the member's goal (passed in); every change is saved to the profile straight away, so it is the same on
 * every device. "Reset" goes back to the defaults for their goal.
 */
export function CustomizeLayout({ defaultOrder, prefs }: { defaultOrder: HomeModule[]; prefs: LayoutPrefs }) {
  const [order, setOrder] = useState<HomeModule[]>(() => startOrder(defaultOrder, prefs.home?.order));
  const [hidden, setHidden] = useState<Set<HomeModule>>(() => new Set(prefs.home?.hidden ?? []));
  const [faithHidden, setFaithHidden] = useState<Set<FaithSection>>(() => new Set(prefs.faith?.hidden ?? []));
  const [train, setTrain] = useState<{ order: TrainSection[]; hidden: Set<TrainSection> }>(() => ({ order: startOrder(TRAIN_SECTIONS, prefs.train?.order), hidden: new Set(prefs.train?.hidden ?? []) }));
  const [nutrition, setNutrition] = useState<{ order: NutritionSection[]; hidden: Set<NutritionSection> }>(() => ({ order: startOrder(NUTRITION_SECTIONS, prefs.nutrition?.order), hidden: new Set(prefs.nutrition?.hidden ?? []) }));
  const [pending, start] = useTransition();

  type Snapshot = { order: HomeModule[]; hidden: Set<HomeModule>; faithHidden: Set<FaithSection>; train: typeof train; nutrition: typeof nutrition };
  const save = (next: Snapshot) =>
    start(async () => {
      const sec = <T extends string>(s: { order: T[]; hidden: Set<T> }): SectionPrefs<T> => ({ order: s.order, hidden: [...s.hidden] });
      const res = await updateUiPrefsAction({
        layout: { home: { order: next.order, hidden: [...next.hidden] }, faith: { hidden: [...next.faithHidden] }, train: sec(next.train), nutrition: sec(next.nutrition) },
      });
      if (!res.ok) toast.error(res.message ?? "Couldn't save your layout.");
    });
  const snapshot = (): Snapshot => ({ order, hidden, faithHidden, train, nutrition });

  const moveIn = <T extends string>(list: T[], m: T, dir: -1 | 1): T[] | null => {
    const i = list.indexOf(m);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return null;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  };
  const toggled = <T extends string>(set: Set<T>, m: T): Set<T> => {
    const next = new Set(set);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    return next;
  };

  const moveHome = (m: HomeModule, dir: -1 | 1) => {
    const next = moveIn(order, m, dir);
    if (!next) return;
    setOrder(next);
    save({ ...snapshot(), order: next });
  };
  const toggleHome = (m: HomeModule) => {
    const next = toggled(hidden, m);
    setHidden(next);
    save({ ...snapshot(), hidden: next });
  };
  const toggleFaith = (s: FaithSection) => {
    const next = toggled(faithHidden, s);
    setFaithHidden(next);
    save({ ...snapshot(), faithHidden: next });
  };
  const moveTrain = (m: TrainSection, dir: -1 | 1) => {
    const next = moveIn(train.order, m, dir);
    if (!next) return;
    const t = { ...train, order: next };
    setTrain(t);
    save({ ...snapshot(), train: t });
  };
  const toggleTrain = (m: TrainSection) => {
    const t = { ...train, hidden: toggled(train.hidden, m) };
    setTrain(t);
    save({ ...snapshot(), train: t });
  };
  const moveNutrition = (m: NutritionSection, dir: -1 | 1) => {
    const next = moveIn(nutrition.order, m, dir);
    if (!next) return;
    const n = { ...nutrition, order: next };
    setNutrition(n);
    save({ ...snapshot(), nutrition: n });
  };
  const toggleNutrition = (m: NutritionSection) => {
    const n = { ...nutrition, hidden: toggled(nutrition.hidden, m) };
    setNutrition(n);
    save({ ...snapshot(), nutrition: n });
  };
  const reset = () => {
    setOrder(defaultOrder);
    setHidden(new Set());
    setFaithHidden(new Set());
    setTrain({ order: [...TRAIN_SECTIONS], hidden: new Set() });
    setNutrition({ order: [...NUTRITION_SECTIONS], hidden: new Set() });
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
        <SectionList order={order} hidden={hidden} labels={HOME_MODULE_LABELS} always="workout" place="Home" onMove={moveHome} onToggle={toggleHome} />
      </div>
      <div>
        <p className="text-[0.9375rem] font-semibold">Train</p>
        <p className="mb-2 text-sm text-muted-foreground">The sections under today&apos;s workout on the Train tab. Anything hidden is still one tap away in Search.</p>
        <SectionList order={train.order} hidden={train.hidden} labels={TRAIN_SECTION_LABELS} place="Train" onMove={moveTrain} onToggle={toggleTrain} />
      </div>
      <div>
        <p className="text-[0.9375rem] font-semibold">Nutrition</p>
        <p className="mb-2 text-sm text-muted-foreground">
          The sections of the Nutrition tab. Add food, Scan, Meal photo, the daily totals and the meals always stay; Recent foods and Water keep their place above the meals, the rest follow your order under More.
        </p>
        <SectionList order={nutrition.order} hidden={nutrition.hidden} labels={NUTRITION_SECTION_LABELS} place="Nutrition" onMove={moveNutrition} onToggle={toggleNutrition} />
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
