import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DemoNote } from "@/components/demo/demo-note";
import { BackLink } from "@/components/platform/back-link";
import { BibleAsk, type AskMessage } from "@/components/faith/bible-ask";
import { AiConsentCard } from "@/components/coach/ai-consent-card";
import { BIBLE_AI_DISABLED } from "@/lib/bible/ai";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { hasFeature } from "@/lib/domain/plans";
import { Button } from "@/components/ui/button";
import { passageParts, passageText } from "@/server/bible/text";
import { parseReference } from "@/lib/bible/reference";
import { isFlagEnabled } from "@/server/flags";
import { BIBLE_AI_PRO_ONLY, bibleAiRemainingToday } from "@/server/services/bible-ai";

export const metadata = { title: "Ask about the Bible" };

/** The AI Bible study helper: separate from the fitness coach; a Pro AI feature (reading the Bible stays free). */
export default async function AskPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data: latest } = await supabase.from("bible_ai_messages").select("thread_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const thread = (latest?.thread_id as string | undefined) ?? randomUUID();
  const { data: rows } = latest ? await supabase.from("bible_ai_messages").select("role, content, citations").eq("user_id", user.id).eq("thread_id", thread).order("created_at").limit(40) : { data: [] };
  const messages: AskMessage[] = (rows ?? []).map((r) => ({
    role: r.role as AskMessage["role"],
    content: r.content as string,
    citations: ((r.citations as string[] | null) ?? []).map((reference) => {
      const ref = parseReference(reference);
      return { reference, text: (ref && passageText(ref)) ?? "", parts: (ref && passageParts(ref)) ?? undefined };
    }),
  }));
  const plan = await getUserPlan(user.id);
  const entitled = hasFeature(plan, "ai_bible_study");
  const [remaining, aiOn] = await Promise.all([bibleAiRemainingToday(user.id, plan), isFlagEnabled("ai_coach")]);
  // The same two conditions the server enforces before anything is sent (bibleAiBlocked in src/server/services/bible-ai.ts).
  const consented = Boolean(profile.ai_data_consent_at);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader title="Ask about the Bible" description="An AI study helper that answers from the Berean Standard Bible and shows every passage it cites." className="mb-2" />
      <DemoNote topic="bibleAsk" />
      <p className="flex items-start gap-2 rounded-xl border border-border bg-elevated/50 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
        <span>
          This is an AI, not a pastor, and it can be wrong: read the passages for yourself, and bring big questions to your church. Your question is sent to our AI provider to be answered. Your prayer journal and notes are never shared with it.
        </span>
      </p>
      {!entitled ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm" data-testid="bible-ask-pro">
          <p>{BIBLE_AI_PRO_ONLY}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/profile/billing">See Pro All Access</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/faith/bible">Read the Bible (free)</Link>
            </Button>
          </div>
        </div>
      ) : !aiOn ? (
        <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm" data-testid="bible-ask-unavailable">
          {BIBLE_AI_DISABLED}
        </p>
      ) : !consented ? (
        <div className="space-y-3" data-testid="bible-ask-consent">
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            <span className="font-semibold">Allow AI data sharing to ask a question.</span> The helper sends your question to our AI provider, so it waits for your
            permission. It is the same AI data-sharing setting the AI Coach uses, described below; the Bible study helper itself only sends your questions and the
            passages it looks up. You can turn it off any time in{" "}
            <Link href="/profile" className="text-gold-highlight underline-offset-4 hover:underline">
              Profile &amp; Settings → Privacy &amp; data
            </Link>
            .
          </p>
          <AiConsentCard />
        </div>
      ) : (
        <BibleAsk initialThread={thread} initialMessages={messages} remaining={remaining} />
      )}
    </div>
  );
}
