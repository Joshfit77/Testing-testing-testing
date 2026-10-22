import Link from "next/link";
import { Dumbbell, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/domain/exercise-tracking";
import { formatDuration } from "@/lib/domain/units";
import { prescriptionText, supersetLetter } from "@/lib/domain/workout-templates";
import { getServerSupabase } from "@/lib/supabase/server";
import { getPlans, hasFeature } from "@/lib/domain/plans";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { deleteTemplateAction } from "@/server/actions/templates";
import { listTemplates } from "@/server/services/templates";

export const metadata = { title: "My workouts" };

export default async function TemplatesPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [templates, plan] = await Promise.all([listTemplates(supabase, user.id), getUserPlan(user.id)]);
  const units = profile.unit_system;
  const limit = hasFeature(plan, "unlimited_templates") ? null : getPlans()[plan].templateLimit;
  const atLimit = limit !== null && templates.length >= limit;

  return (
    <div className="space-y-5">
      <BackLink href="/train">Train</BackLink>
      <PageHeader title="My workouts" description="Saved custom workouts. Start one, edit it, or build a new one from the exercise library." />
      <div className="grid grid-cols-2 gap-2">
        {atLimit ? (
          <Button asChild variant="secondary">
            <Link href="/profile/billing">
              <Plus aria-hidden /> Unlimited with Plus
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/train/templates/new">
              <Plus aria-hidden /> New workout
            </Link>
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link href="/train/workout?blank=1">
            <Dumbbell aria-hidden /> Empty workout
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Logged an empty workout you liked? Save it as a template from the summary screen when you finish.</p>
      {limit !== null && (
        <p className="text-sm text-muted-foreground" data-testid="template-limit">
          {templates.length} of {limit} saved workouts on Free.{" "}
          {atLimit ? "Delete one to save another, or " : ""}
          <Link href="/profile/billing" className="text-gold underline-offset-4 hover:underline">
            {atLimit ? "upgrade to Plus" : "Plus"}
          </Link>{" "}
          {atLimit ? "for unlimited workouts." : "keeps unlimited workouts."}
        </p>
      )}

      {templates.length === 0 ? (
        <EmptyState title="No saved workouts yet" description="Build one from the exercise library — order, sets, reps, time or distance, rest and supersets." />
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{t.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t.exercises.length} {t.exercises.length === 1 ? "exercise" : "exercises"}
                    {t.exercises.some((e) => e.supersetGroup != null) ? ` · ${new Set(t.exercises.map((e) => e.supersetGroup).filter((g) => g != null)).size} superset(s)` : ""}
                  </p>
                </div>
                <ActionButton
                  action={deleteTemplateAction}
                  fields={{ id: t.id }}
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${t.name}`}
                  confirmMessage={`Delete ${t.name}?`}
                  confirmDetail="Workouts you already logged from it stay in your history."
                  confirmLabel="Delete"
                >
                  <Trash2 aria-hidden />
                </ActionButton>
              </div>
              <ol className="mt-2 space-y-1 text-sm">
                {t.exercises.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {e.supersetGroup != null && <span className="mr-1 font-semibold text-gold">{supersetLetter(e.supersetGroup)}</span>}
                      {e.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{prescriptionText(e, (m) => formatDistance(m, units), formatDuration)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild>
                  <Link href={`/train/workout?template=${t.id}`}>
                    <Play aria-hidden /> Start
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/train/templates/${t.id}`}>
                    <Pencil aria-hidden /> Edit
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
