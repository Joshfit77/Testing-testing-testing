import { Dumbbell, HandHeart, MessageCircleQuestion } from "lucide-react";
import type { Devotional } from "@/data/devotionals";
import { TRANSLATION } from "@/data/content";

/** Full devotional body: scripture, reading, prayer, training prompt and reflection question. */
export function DevotionalContent({ devotional }: { devotional: Devotional }) {
  return (
    <div className="space-y-4">
      <figure className="rounded-xl border border-gold-muted/40 bg-gold/5 p-4">
        <blockquote className="text-sm italic leading-relaxed text-foreground/90">&ldquo;{devotional.scripture}&rdquo;</blockquote>
        <figcaption className="mt-2 text-xs font-semibold text-gold">{devotional.reference} ({TRANSLATION.code})</figcaption>
      </figure>
      <p className="text-sm leading-relaxed text-foreground/90">{devotional.devotional}</p>
      <dl className="space-y-3 text-sm">
        <div className="flex gap-3">
          <dt className="mt-0.5 shrink-0">
            <HandHeart className="size-4 text-gold" aria-hidden />
            <span className="sr-only">Prayer</span>
          </dt>
          <dd className="italic text-foreground/90">{devotional.prayer}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="mt-0.5 shrink-0">
            <Dumbbell className="size-4 text-gold" aria-hidden />
            <span className="sr-only">Train today</span>
          </dt>
          <dd>
            <span className="font-semibold text-gold-highlight">Train today: </span>
            {devotional.train}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="mt-0.5 shrink-0">
            <MessageCircleQuestion className="size-4 text-gold" aria-hidden />
            <span className="sr-only">Reflect</span>
          </dt>
          <dd>
            <span className="font-semibold text-gold-highlight">Reflect: </span>
            {devotional.reflection}
          </dd>
        </div>
      </dl>
    </div>
  );
}
