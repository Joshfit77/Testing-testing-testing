"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";
import { parseQuantity } from "@/lib/domain/food-units";
import { addGroceryItemAction, generateGroceryAction, removeGroceryItemAction, toggleGroceryItemAction } from "@/server/actions/grocery";

function Message({ state }: { state: ActionState | null }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-[#5fc49a]" : "text-sm text-[#f08a8a]"}>
      {state.message}
    </p>
  );
}

export function GenerateGroceryForm({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await generateGroceryAction({ from, to });
          setState(res);
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="grocery-from">From</Label>
          <Input id="grocery-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="grocery-to">To</Label>
          <Input id="grocery-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} Build list from my plan
      </Button>
      <Message state={state} />
    </form>
  );
}

export interface GroceryItemView {
  id: string;
  name: string;
  amount: string | null;
  note: string | null;
  checked: boolean;
  origin: "plan" | "manual";
}

export function GroceryItems({ items }: { items: GroceryItemView[] }) {
  const router = useRouter();
  // Optimistic check marks; the server list wins after refresh.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOverrides({}), [items]);
  const toggle = async (id: string, checked: boolean) => {
    setOverrides((o) => ({ ...o, [id]: checked }));
    const res = await toggleGroceryItemAction({ id, checked });
    if (!res.ok) {
      setOverrides((o) => ({ ...o, [id]: !checked }));
      setError(res.message ?? "Couldn't update that item.");
      return;
    }
    setError(null);
    router.refresh();
  };
  const isChecked = (i: GroceryItemView) => overrides[i.id] ?? i.checked;
  const open = items.filter((i) => !isChecked(i));
  const done = items.filter(isChecked);
  const row = (i: GroceryItemView) => (
    <li key={i.id} className="flex items-start gap-2 py-1.5" data-testid="grocery-item">
      <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-3 py-1.5">
        <input type="checkbox" checked={isChecked(i)} onChange={(e) => void toggle(i.id, e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#C9A54C]" aria-label={`${i.name}${i.amount ? `, ${i.amount}` : ""}`} />
        <span className="min-w-0">
          <span className={isChecked(i) ? "text-[0.9375rem] text-muted-foreground line-through" : "text-[0.9375rem]"}>
            <span className="font-semibold">{i.name}</span>
            {i.amount && <span className="tabular-nums"> · {i.amount}</span>}
          </span>
          {i.note && <span className="block text-sm text-muted-foreground">{i.note}</span>}
          {i.origin === "manual" && <span className="block text-sm text-muted-foreground">Added by you</span>}
        </span>
      </label>
      <ActionButton action={removeGroceryItemAction} fields={{ id: i.id }} size="icon" variant="ghost" aria-label={`Remove ${i.name}`} confirmMessage={`Remove ${i.name} from the list?`} confirmLabel="Remove">
        <X aria-hidden />
      </ActionButton>
    </li>
  );
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-[#f08a8a]">
          {error}
        </p>
      )}
      {open.length > 0 ? <ul className="divide-y divide-border">{open.map(row)}</ul> : <p className="text-sm text-muted-foreground">Everything is checked off.</p>}
      {done.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground">In the cart ({done.length})</p>
          <ul className="divide-y divide-border">{done.map(row)}</ul>
        </div>
      )}
    </div>
  );
}

export function AddGroceryItemForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const quantity = qty.trim() ? parseQuantity(qty) : null;
  const qtyBad = quantity != null && !(quantity > 0);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (qtyBad) return;
        start(async () => {
          const res = await addGroceryItemAction({ name, quantity, unit: unit.trim() || undefined });
          setState(res);
          if (res.ok) {
            setName("");
            setQty("");
            setUnit("");
            router.refresh();
          }
        });
      }}
    >
      <div className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2">
        <div className="space-y-1">
          <Label htmlFor="grocery-name">Item</Label>
          <Input id="grocery-name" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Coffee" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="grocery-qty">Qty</Label>
          <Input id="grocery-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={qtyBad} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="grocery-unit">Unit</Label>
          <Input id="grocery-unit" value={unit} maxLength={60} onChange={(e) => setUnit(e.target.value)} placeholder="bag" />
        </div>
      </div>
      <Button type="submit" variant="secondary" disabled={pending || !name.trim() || qtyBad}>
        <Plus aria-hidden /> Add item
      </Button>
      <Message state={state} />
    </form>
  );
}
