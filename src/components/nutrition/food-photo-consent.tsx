"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setFoodPhotoConsentAction } from "@/server/actions/food-photo";

export function FoodPhotoConsentCard() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="space-y-4 rounded-2xl border border-gold-muted/60 bg-card p-5" aria-labelledby="photo-consent-title" data-testid="food-photo-consent">
      <h2 id="photo-consent-title" className="flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="size-5 text-gold" aria-hidden /> Before you analyse a meal photo
      </h2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm">
        <li>Each photo you choose to analyse is sent, over an encrypted connection, to Anthropic&apos;s Claude AI to estimate what&apos;s on the plate.</li>
        <li>Narrow Gate Fitness doesn&apos;t store the photo: it&apos;s resized on your device, sent once, and discarded. Only the items you confirm are saved, as diary entries marked as estimates.</li>
        <li>Results are estimates, not measurements. You check and correct every item before anything is added to your diary.</li>
        <li>Each photo uses one of your monthly AI messages, and you can analyse up to 20 photos a day.</li>
        <li>You can turn this off any time on this page.</li>
      </ul>
      <label className="flex items-start gap-3 rounded-xl border border-border bg-elevated/60 p-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-5 accent-[#cfa53e]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I agree to send the meal photos I choose to the AI provider for analysis.</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-[#f08a8a]">
          {error}
        </p>
      )}
      <Button
        disabled={!agreed || pending}
        onClick={() =>
          start(async () => {
            const r = await setFoodPhotoConsentAction(true);
            if (!r.ok) return setError(r.error);
            router.refresh();
          })
        }
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />} Agree and continue
      </Button>
    </section>
  );
}
