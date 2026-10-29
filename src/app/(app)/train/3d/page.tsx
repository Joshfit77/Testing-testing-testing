import { EXERCISES } from "@/data/exercises";
import { IN_APP_3D } from "@/lib/anatomy3d/in-app";
import { requireOnboardedUser } from "@/server/auth";
import { BackLink } from "@/components/platform/back-link";
import { Showcase3D } from "@/components/train/showcase-3d";

export const metadata = { title: "3D exercise showcase" };

/**
 * The 3D exercise showcase (the owner's DEMO 1, inside the real app): the exercises the app demonstrates with the 3D
 * anatomical figure, switched in place, each with the same player the workout screen and the exercise pages use
 * (src/components/train/exercise-demo-3d.tsx: the illustration while the model loads, as the fallback and as a choice).
 */
export default async function Showcase3DPage() {
  await requireOnboardedUser();
  const exercises = IN_APP_3D.map((slug) => EXERCISES.find((e) => e.slug === slug)).filter((e): e is NonNullable<typeof e> => !!e);
  return (
    <div className="space-y-4 px-4 pb-8 pt-3">
      <BackLink href="/train/exercises">Exercises</BackLink>
      <header>
        <h1 className="text-2xl font-bold text-gold-highlight">3D exercise showcase</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The exercises the app demonstrates with the 3D anatomical figure. A computer model performing the app&apos;s motions, not filmed video. One finger turns it, pinch to zoom.
        </p>
      </header>
      <Showcase3D
        exercises={exercises.map((e) => ({
          slug: e.slug,
          name: e.name,
          description: e.description,
          instructions: e.instructions,
          primary: e.primary,
          secondary: e.secondary,
          equipment: e.equipment,
          meta: { name: e.name, pattern: e.pattern, category: e.category, equipment: e.equipment, timed: e.timed ?? false },
        }))}
      />
    </div>
  );
}
