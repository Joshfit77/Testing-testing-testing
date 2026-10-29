"use client";

import { useState } from "react";
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/domain/types";
import { titleCase } from "@/lib/utils";
import { ExerciseDemo3D, type ExerciseDemo3DProps } from "@/components/train/exercise-demo-3d";

export interface ShowcaseExercise {
  slug: string;
  name: string;
  description: string;
  instructions: string[];
  primary: string[];
  secondary: string[];
  equipment: Equipment[];
  meta: NonNullable<ExerciseDemo3DProps["meta"]>;
}

/**
 * The 3D showcase's body: tabs for the exercises, the real in-app 3D player for the chosen one (remounted per
 * exercise, so switching never reloads the page; the model's files are kept once fetched), its instructions and
 * muscles, and its status: a preview awaiting the owner's approval.
 */
export function Showcase3D({ exercises }: { exercises: ShowcaseExercise[] }) {
  const [slug, setSlug] = useState(exercises[0]?.slug ?? "");
  const ex = exercises.find((e) => e.slug === slug) ?? exercises[0];
  if (!ex) return <p className="text-sm text-muted-foreground">No exercise is shown with the 3D figure yet.</p>;
  return (
    <div className="space-y-4" data-testid="showcase-3d">
      <div role="tablist" aria-label="Exercises" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {exercises.map((e) => (
          <button
            key={e.slug}
            type="button"
            role="tab"
            aria-selected={e.slug === ex.slug}
            onClick={() => setSlug(e.slug)}
            className={`shrink-0 rounded-full border px-3 py-2 text-sm ${e.slug === ex.slug ? "border-gold bg-gold/15 text-gold-highlight" : "border-border text-foreground"}`}
          >
            {e.name}
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-border bg-card">
        <ExerciseDemo3D key={ex.slug} slug={ex.slug} name={ex.name} meta={ex.meta} className="aspect-[4/3] w-full rounded-t-2xl" />
        <p className="px-3 pb-3 pt-2 text-[0.6875rem] text-muted-foreground">
          Preview, awaiting the owner&apos;s approval: this motion passes the automated checks and a visual review, and is shown here for that review. The animated illustration is the fallback and can be chosen above.
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-gold-highlight">{ex.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{ex.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {ex.equipment.map((q) => (
            <span key={q} className="rounded-full border border-border px-2 py-0.5">
              {EQUIPMENT_LABELS[q] ?? titleCase(q)}
            </span>
          ))}
        </div>
        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wider text-gold">Instructions</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
          {ex.instructions.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold">Primary muscles</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {ex.primary.map((m) => (
                <li key={m}>{titleCase(m)}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold">Secondary muscles</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {ex.secondary.map((m) => (
                <li key={m}>{titleCase(m)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
