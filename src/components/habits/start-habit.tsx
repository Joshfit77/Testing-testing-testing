"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startHabitProgramAction } from "@/server/actions/habit-programs";

export function StartHabitProgram({ slug, label = "Start program" }: { slug: string; label?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startHabitProgramAction(slug);
            if (r.ok) router.refresh();
            else setError(r.error);
          })
        }
      >
        {pending ? "Starting…" : label}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
