import Link from "next/link";
import { BackLink } from "@/components/platform/back-link";
import { StudyPlanForm } from "@/components/biblical-ai/study-plan-form";
import { STUDY_DURATIONS, STUDY_TOPICS } from "@/lib/biblical-ai/config";
import { loadBiblicalAiAccess } from "@/server/biblical-ai-access";

export const metadata = { title: "New personalized study · Narrow Gate Biblical AI" };
// Generating a long study can take up to about three minutes (the server action runs under this page's limit).
export const maxDuration = 180;

/** Create a personalized Bible study (Pro All Access). */
export default async function NewStudyPage({ searchParams }: { searchParams: Promise<{ passage?: string; topic?: string }> }) {
  const sp = await searchParams;
  const access = await loadBiblicalAiAccess();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith/biblical-ai">Biblical AI</BackLink>
      <h1 className="font-display text-2xl font-bold">New personalized study</h1>
      <p className="text-sm text-muted-foreground">
        A day-by-day study with readings from the Berean Standard Bible, explanations in context, reflection questions and application. Every reading is checked against the Bible before the study is saved.
      </p>
      {access.limits.tier !== "pro" ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm" data-testid="study-plan-pro">
          <p>Personalized Bible studies are included with Pro All Access. The Bible, reading journeys and the Faith section&apos;s studies stay free.</p>
          <Link href="/profile/billing" className="inline-flex h-11 items-center rounded-full bg-gold-gradient px-5 font-semibold text-black">
            See Pro All Access
          </Link>
        </div>
      ) : !access.canAsk || !access.consented ? (
        <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">
          {access.canAsk ? "Allow AI data sharing on the Biblical AI screen first." : "Biblical AI is temporarily unavailable."}
        </p>
      ) : (
        <StudyPlanForm topics={[...STUDY_TOPICS]} durations={[...STUDY_DURATIONS]} passage={sp.passage ?? null} initialTopic={sp.topic ?? ""} />
      )}
    </div>
  );
}
