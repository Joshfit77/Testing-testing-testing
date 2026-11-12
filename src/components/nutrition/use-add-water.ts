"use client";

import { useRef, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import { attemptId, saveFailed, waterAttemptKey } from "@/lib/domain/diary";
import { addWaterAction, type WaterResult } from "@/server/actions/nutrition";

/**
 * Water quick-add for the Nutrition card, Home and Quick Add. Each tap gets one client id, and retrying that tap
 * after a failed send (offline, dropped response) reuses it, so the server keeps a single entry for it; the id is
 * cleared once the server confirms, so the next tap is a new glass. Use `add` as a form action so the submit button
 * shows its pending state.
 */
export function useAddWater(date: string) {
  const [state, setState] = useState<WaterResult>(initialActionState);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const add = async (amountMl: number) => {
    const fd = new FormData();
    fd.set("date", date);
    fd.set("amountMl", String(amountMl));
    fd.set("clientId", attemptId(attempt, waterAttemptKey(date, amountMl)));
    try {
      const res = await addWaterAction(initialActionState, fd);
      if (res.ok) attempt.current = null;
      setState(res);
    } catch {
      // The request never came back: the next tap of the same amount retries with the same id.
      setState(saveFailed());
    }
  };
  return { state, add };
}
