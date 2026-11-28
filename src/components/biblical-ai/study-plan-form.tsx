"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { generateStudyAction } from "@/server/actions/biblical-ai";

/** Topic and length for a personalized study. One request id per study, so pressing again never makes two. */
export function StudyPlanForm({ topics, durations, passage, initialTopic }: { topics: string[]; durations: number[]; passage: string | null; initialTopic: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic || topics[0]!);
  const [custom, setCustom] = useState("");
  const [days, setDays] = useState(7);
  const [pending, start] = useTransition();
  const requestId = useRef<string | null>(null);
  const chosen = topic === "__custom" ? custom.trim() : topic;
  return (
    <form
      className="space-y-3 rounded-2xl border border-gold-muted/60 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (chosen.length < 3) return;
        requestId.current ??= crypto.randomUUID();
        start(async () => {
          const r = await generateStudyAction({ topic: chosen, days, passage, requestId: requestId.current! });
          if (!r.ok) {
            toast.error(r.error);
            // A new attempt after a failure is a new request (nothing was saved or counted for the failed one).
            requestId.current = null;
            return;
          }
          router.push(`/faith/biblical-ai/studies/${r.studyId}`);
        });
      }}
    >
      <label htmlFor="study-topic" className="block text-sm font-semibold">
        Topic
      </label>
      <NativeSelect id="study-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
        {topics.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value="__custom">Another topic…</option>
      </NativeSelect>
      {topic === "__custom" && (
        <>
          <label htmlFor="study-custom" className="block text-sm font-semibold">
            Your topic
          </label>
          <Input id="study-custom" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={160} placeholder="e.g. Contentment" />
        </>
      )}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Length</legend>
        <div className="flex flex-wrap gap-2">
          {durations.map((d) => (
            <label key={d} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold ${days === d ? "border-gold bg-gold/15 text-gold-highlight" : "border-border"}`}>
              <input type="radio" name="days" value={d} checked={days === d} onChange={() => setDays(d)} className="sr-only" />
              {d} days
            </label>
          ))}
        </div>
      </fieldset>
      {passage && <p className="text-sm text-muted-foreground">Starting from {passage}.</p>}
      <Button type="submit" disabled={pending || chosen.length < 3}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} {pending ? "Preparing and checking your study…" : "Create study"}
      </Button>
      {pending && days >= 30 && <p className="text-xs text-muted-foreground">Longer studies can take up to two minutes.</p>}
    </form>
  );
}
