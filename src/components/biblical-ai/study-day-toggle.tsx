"use client";

import { useSafeTransition } from "@/lib/use-safe-transition";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { setStudyDayDoneAction } from "@/server/actions/biblical-ai";

export function StudyDayToggle({ studyId, day, done: initial }: { studyId: string; day: number; done: boolean }) {
  const [done, setDone] = useState(initial);
  const [pending, start] = useSafeTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={done ? "secondary" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setStudyDayDoneAction(studyId, day, !done);
          if (!r.ok) return toast.error(r.error);
          setDone(!done);
        })
      }
    >
      <Check aria-hidden /> {done ? `Day ${day} done` : `Mark day ${day} done`}
    </Button>
  );
}
