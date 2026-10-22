"use client";

import { Check, Dumbbell, Flame, Lock, Sprout } from "lucide-react";
import { BADGE_IMAGE_OVERRIDES } from "@/components/badges/badge-art";
import { getBadgeArtwork } from "@/components/badges/badge-artwork";
import { RANK_CATEGORIES, type PlanCategoryProgress, type PlanRankState, type RankCategory } from "@/lib/domain/ranks";
import { cn } from "@/lib/utils";

/**
 * The nine ranks of one category laid out like the owner's badge design: an ornate gold frame, the category
 * crest and title, then numbered rows with the painted artwork, the rank name in engraved gold capitals,
 * its Scripture reference and theme line. Every badge stays in full colour; locked ranks are dimmed a little
 * and carry a small lock, earned ranks a gold check and their verse in full, and the current rank glows.
 */

const CREST: Record<RankCategory, typeof Dumbbell> = { fitness: Dumbbell, food: Flame, faith: Sprout };

/** The owner's artwork for a row. */
export function rowArt(category: RankCategory, level: number): string | undefined {
  return BADGE_IMAGE_OVERRIDES[`${category}-${level}`];
}

export function RankLadder({
  progress,
  onOpen,
  verses,
  translation,
}: {
  progress: PlanCategoryProgress;
  onOpen: (r: PlanRankState) => void;
  /** BSB text by reference; an earned rank shows its verse in full. */
  verses: Record<string, string>;
  translation: string;
}) {
  const info = RANK_CATEGORIES.find((c) => c.id === progress.category)!;
  const Crest = CREST[progress.category];
  const unit = (n: number) => (n === 1 ? info.unit[0] : info.unit[1]);
  return (
    <section className="rank-frame" aria-label={`${info.label} badges`}>
      <span className="rank-corner rank-corner-tl" aria-hidden />
      <span className="rank-corner rank-corner-tr" aria-hidden />
      <span className="rank-corner rank-corner-bl" aria-hidden />
      <span className="rank-corner rank-corner-br" aria-hidden />
      <header className="rank-head">
        <p className="rank-title">
          <Crest className={cn("rank-crest", `rank-crest-${progress.category}`)} aria-hidden />
          {info.label}
        </p>
        <p className="rank-subtitle">{info.subtitle}</p>
      </header>
      <ol className="rank-rows" aria-label={`${info.label} ranks`}>
        {progress.ranks.map((r) => {
          const current = progress.current?.level === r.level;
          const art = rowArt(r.category, r.level);
          return (
            <li key={r.level}>
              <button
                type="button"
                onClick={() => onOpen(r)}
                className={cn("rank-row", r.earned ? "is-earned" : "is-locked", current && "is-current")}
                aria-label={`${r.name}, rank ${r.level} of 9, ${r.planLocked ? "included with Plus" : r.earned ? "earned" : "locked"}`}
              >
                <span className="rank-num" aria-hidden>
                  <span>{r.level}</span>
                </span>
                <span className="rank-art">
                  {art ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={art}
                      alt=""
                      width={getBadgeArtwork(r.category, r.level)?.width}
                      height={getBadgeArtwork(r.category, r.level)?.height}
                      draggable={false}
                      decoding="async"
                    />
                  ) : null}
                  {r.earned ? null : (
                    <span className="rank-lock">
                      <Lock aria-hidden />
                    </span>
                  )}
                </span>
                <span className="rank-text">
                  <span className="rank-name">{r.name}</span>
                  <span className="rank-ref">{r.reference}</span>
                  <span className="rank-theme">{r.theme}</span>
                  {r.planLocked ? (
                    <span className="rank-state is-plan">
                      <Lock aria-hidden /> {r.reached ? "Reached · included with Plus" : "Included with Plus"}
                    </span>
                  ) : r.earned ? (
                    <>
                      <span className="rank-state is-done">
                        <Check aria-hidden /> Earned
                      </span>
                      <span className="rank-bar is-full" aria-hidden>
                        <span style={{ width: "100%" }} />
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="rank-state">
                        {Math.min(progress.count, r.threshold).toLocaleString("en-US")} / {r.threshold.toLocaleString("en-US")} {unit(r.threshold)}
                      </span>
                      <span className="rank-bar" aria-hidden>
                        <span style={{ width: `${Math.min(100, Math.round((progress.count / r.threshold) * 100))}%` }} />
                      </span>
                    </>
                  )}
                </span>
              </button>
              {r.earned && verses[r.reference] ? (
                <figure className={cn("rank-verse", current && "is-current")}>
                  <blockquote className="rank-verse-text">{verses[r.reference]}</blockquote>
                  <figcaption className="rank-verse-ref">
                    {r.reference} ({translation})
                  </figcaption>
                </figure>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
