"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAiDataConsentAction } from "@/server/actions/profile";

/**
 * Asks before the AI coach sends anything to the AI provider (App Store guideline 5.1.2(i)). The list matches what
 * `src/server/coach/snapshot.ts` and the coach tools read; keep the two in step.
 */
export function AiConsentCard() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allow = () =>
    start(async () => {
      setError(null);
      const res = await setAiDataConsentAction(true);
      if (!res.ok) setError(res.message ?? "Couldn't save your choice. Please try again.");
      else router.refresh();
    });

  return (
    <section className="space-y-4 rounded-2xl border border-gold-muted/60 bg-card p-5" aria-labelledby="ai-consent-title">
      <h2 id="ai-consent-title" className="flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="size-5 text-gold" aria-hidden /> Before you start: your data and the AI Coach
      </h2>
      <p className="text-sm text-muted-foreground">
        The AI Coach is powered by Claude, an AI model made by Anthropic. To answer you, each message you send goes to Anthropic together with
        the parts of your account the coach needs:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Your goals, schedule, equipment and basic details (age, height, sex, units)</li>
        <li>Your current program, recent workouts and personal records</li>
        <li>Your food log, nutrition targets and supplement stack</li>
        <li>Bodyweight, steps and recovery check-ins</li>
        <li>Limitation notes, only if you agreed to store wellness information</li>
        <li>Prayer-journal entries, only the ones you mark &ldquo;Share with AI Coach&rdquo;</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Progress photos and unshared journal entries are never sent. Nothing is sent until you allow it, and you can turn this off any time in
        Profile &amp; Settings → Privacy &amp; data.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={allow} disabled={pending}>
          {pending ? "Saving…" : "Allow and continue"}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/home">Not now</Link>
        </Button>
      </div>
    </section>
  );
}
