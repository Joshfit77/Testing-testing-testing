"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMemoryByReferenceAction } from "@/server/actions/bible";

export function MemoryAddForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(addMemoryByReferenceAction, { ok: false });
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  return (
    <form ref={ref} action={action} className="space-y-1.5">
      <label htmlFor="memory-ref" className="text-sm font-medium">
        Add a passage
      </label>
      <div className="flex gap-2">
        <Input id="memory-ref" name="reference" placeholder="e.g. Philippians 4:6–7" maxLength={60} required className="min-w-0 flex-1" />
        <Button type="submit" size="icon" disabled={pending} aria-label="Add">
          <Plus aria-hidden />
        </Button>
      </div>
      {state.message && (
        <p className={state.ok ? "text-sm text-gold-highlight" : "text-sm text-destructive"} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Or tap verses while reading and choose Memorize.</p>
    </form>
  );
}
