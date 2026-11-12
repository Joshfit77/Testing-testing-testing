"use client";

import { useEffect, useState, useTransition } from "react";
import { Star } from "lucide-react";
import type { FoodChoice } from "@/lib/domain/food-basis";
import { isFavoritableKey } from "@/lib/domain/food-favorites";
import { cn } from "@/lib/utils";
import { setFoodFavoriteAction } from "@/server/actions/nutrition";

/**
 * Star toggle for a food (search results, the amount step, diary rows, the Favorites tab).
 * Optimistic: the star flips immediately and flips back if the save fails.
 */
export function FavoriteStar({
  food,
  initial,
  onChange,
  className,
}: {
  food: Pick<FoodChoice, "key" | "name" | "detail" | "basis" | "isEstimate">;
  initial: boolean;
  onChange?: (favorite: boolean) => void;
  className?: string;
}) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setOn(initial), [initial]);
  if (!isFavoritableKey(food.key)) return null;

  const toggle = () => {
    const next = !on;
    setOn(next);
    setError(null);
    onChange?.(next);
    start(async () => {
      const res = await setFoodFavoriteAction({
        key: food.key,
        favorite: next,
        name: food.name,
        detail: food.detail?.slice(0, 200),
        basis: food.basis,
        isEstimate: Boolean(food.isEstimate),
      });
      if (!res.ok) {
        setOn(!next);
        onChange?.(!next);
        setError(res.message ?? "Couldn't update favorites.");
      }
    });
  };

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-busy={pending}
        aria-label={on ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`}
        title={error ?? (on ? "Favorite" : "Add to favorites")}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-gold-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
          on && "text-gold",
          className,
        )}
      >
        <Star className={cn("size-5", on && "fill-current")} aria-hidden />
      </button>
      {error && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </span>
  );
}
