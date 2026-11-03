import { randomUUID } from "node:crypto";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DemoNote } from "@/components/demo/demo-note";
import { BackLink } from "@/components/platform/back-link";
import { BibleAsk, type AskMessage } from "@/components/faith/bible-ask";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { passageParts, passageText } from "@/server/bible/text";
import { parseReference } from "@/lib/bible/reference";
import { bibleAiRemainingToday } from "@/server/services/bible-ai";

export const metadata = { title: "Ask about the Bible" };

/** The Bible study helper: separate from the fitness coach, free within daily limits. */
export default async function AskPage() {
  const { user } = await requireOnboardedUser();
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
  const remaining = await bibleAiRemainingToday(user.id, await getUserPlan(user.id));

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
      <BibleAsk initialThread={thread} initialMessages={messages} remaining={remaining} />
    </div>
  );
}
