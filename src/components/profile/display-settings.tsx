"use client";

import { useState, useTransition } from "react";
import { applyDisplayPrefs, type TextSize } from "@/components/shell/app-shell";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { updateUiPrefsAction, type UiPrefsInput } from "@/server/actions/ui-prefs";

const SIZES: { value: TextSize; label: string; sample: string }[] = [
  { value: "default", label: "Default", sample: "text-base" },
  { value: "large", label: "Large", sample: "text-lg" },
  { value: "xlarge", label: "Extra large", sample: "text-xl" },
];

/** Text size, motion and Home Scripture preferences. Applied instantly, saved to the profile. */
export function DisplaySettings({ initial }: { initial: { textSize: TextSize; reduceMotion: boolean; homeScripture: boolean } }) {
  const [textSize, setTextSize] = useState<TextSize>(initial.textSize);
  const [reduceMotion, setReduceMotion] = useState(initial.reduceMotion);
  const [homeScripture, setHomeScripture] = useState(initial.homeScripture);
  const [pending, start] = useTransition();

  const save = (patch: UiPrefsInput, revert: () => void) =>
    start(async () => {
      const res = await updateUiPrefsAction(patch);
      if (!res.ok) {
        revert();
        toast.error(res.message ?? "Couldn't save that setting.");
      }
    });

  const chooseSize = (next: TextSize) => {
    const prev = textSize;
    setTextSize(next);
    applyDisplayPrefs(next, reduceMotion);
    save({ textSize: next }, () => {
      setTextSize(prev);
      applyDisplayPrefs(prev, reduceMotion);
    });
  };

  return (
    <div className="space-y-5" aria-busy={pending}>
      <fieldset>
        <legend className="text-[0.9375rem] font-semibold">Text size</legend>
        <p className="mb-2 text-sm text-muted-foreground">Builds on your phone&apos;s text-size setting.</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={textSize === s.value}
              onClick={() => textSize !== s.value && chooseSize(s.value)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-colors",
                textSize === s.value ? "border-gold bg-gold/10 text-gold-highlight" : "border-border bg-elevated/50 text-foreground hover:border-gold-muted",
              )}
            >
              <span className={cn("font-semibold leading-none", s.sample)} aria-hidden>
                Aa
              </span>
              <span className="mt-1 text-sm">{s.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="pref-motion" className="text-[0.9375rem] font-semibold">
            Reduce motion
          </p>
          <p className="text-sm text-muted-foreground">Turns off page animations and celebration confetti.</p>
        </div>
        <Switch
          checked={reduceMotion}
          aria-labelledby="pref-motion"
          onCheckedChange={(v) => {
            setReduceMotion(v);
            applyDisplayPrefs(textSize, v);
            save({ reduceMotion: v }, () => {
              setReduceMotion(!v);
              applyDisplayPrefs(textSize, !v);
            });
          }}
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="pref-scripture" className="text-[0.9375rem] font-semibold">
            Scripture card on Home
          </p>
          <p className="text-sm text-muted-foreground">Shows the verse of the day on Home. The Faith tab stays either way.</p>
        </div>
        <Switch
          checked={homeScripture}
          aria-labelledby="pref-scripture"
          onCheckedChange={(v) => {
            setHomeScripture(v);
            save({ homeScripture: v }, () => setHomeScripture(!v));
          }}
        />
      </div>
    </div>
  );
}
