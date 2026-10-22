"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { titleCase } from "@/lib/utils";

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  isTimed: boolean;
  category: string;
  primary: string[];
}

export function ExercisePicker({
  open,
  onOpenChange,
  title,
  description,
  catalog,
  suggestedIds = [],
  excludeId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  catalog: CatalogItem[];
  suggestedIds?: string[];
  excludeId?: string;
  onPick: (item: CatalogItem) => void;
}) {
  const [q, setQ] = useState("");
  const suggested = useMemo(() => suggestedIds.map((id) => catalog.find((c) => c.id === id)).filter(Boolean) as CatalogItem[], [suggestedIds, catalog]);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return catalog
      .filter((c) => c.id !== excludeId)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.primary.some((m) => m.toLowerCase().includes(term)))
      .slice(0, 60);
  }, [q, catalog, excludeId]);

  const pick = (item: CatalogItem) => {
    onPick(item);
    setQ("");
    onOpenChange(false);
  };

  const Row = ({ item }: { item: CatalogItem }) => (
    <li>
      <button
        type="button"
        onClick={() => pick(item)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-elevated focus-visible:bg-elevated"
      >
        <span>
          <span className="block text-sm font-semibold">{item.name}</span>
          <span className="block text-xs text-muted-foreground">{item.primary.slice(0, 3).map(titleCase).join(", ")}</span>
        </span>
        <span className="shrink-0 text-[0.6875rem] uppercase tracking-wider text-muted-foreground">{item.isTimed ? "Timed" : titleCase(item.category)}</span>
      </button>
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="bottom" className="max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <label className="relative mb-3 block">
          <span className="sr-only">Search exercises</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or muscle" className="pl-9" />
        </label>
        {!q && suggested.length > 0 && (
          <>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gold">Suggested alternatives</p>
            <ul className="mb-3">
              {suggested.map((s) => (
                <Row key={s.id} item={s} />
              ))}
            </ul>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">All exercises</p>
          </>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          {results.map((r) => (
            <Row key={r.id} item={r} />
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No exercises match “{q}”.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
