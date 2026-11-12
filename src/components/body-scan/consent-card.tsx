"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { giveBodyScanConsentAction } from "@/server/actions/body-scan";

const POINTS = [
  "Body Scan stores the front, side and optional rear photos you take, plus any measurements you enter.",
  "Photos are resized on this device before upload, and location data is removed.",
  "They're kept in private storage that only your account can open. Our team and admins can't view them.",
  "Your photos are never sent to the AI coach or to any other company or service. If that ever changes, we'll ask for your separate consent first.",
  "Body Scan does not estimate body fat. A phone camera can't measure body fat or visceral fat, so we don't guess.",
  "Delete any scan at any time, or withdraw this consent to delete every scan at once. Scans are also deleted with your account and included in your data export.",
];

export function BodyScanConsentCard() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card data-testid="body-scan-consent">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <ShieldCheck className="size-7 shrink-0 text-gold" aria-hidden />
        <CardTitle>Before your first scan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <label className="flex items-start gap-3 rounded-xl border border-border bg-elevated/60 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-[#cfa53e]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I agree to Narrow Gate Fitness storing my body scan photos and measurements as described above.</span>
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
              const r = await giveBodyScanConsentAction(agreed);
              if (!r.ok) return setError(r.error);
              router.refresh();
            })
          }
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />} Agree and continue
        </Button>
      </CardContent>
    </Card>
  );
}
