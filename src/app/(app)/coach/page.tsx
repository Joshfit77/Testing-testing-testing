import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { CoachChat, type ChatMessage } from "@/components/coach/coach-chat";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { hasFeature } from "@/lib/domain/plans";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { isAiConfigured, isServiceRoleConfigured } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { getAiUsage } from "@/server/services/ai-coach";

export const metadata = { title: "AI Coach" };

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const plan = await getUserPlan(user.id);
  const [convRes, exRes, flag, usage] = await Promise.all([
    supabase.from("ai_conversations").select("id, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30),
    supabase.from("exercises").select("slug, name"),
    isFlagEnabled("ai_coach"),
    getAiUsage(user.id, plan),
  ]);
  const conversations = convRes.data ?? [];
  const selected = sp.c && conversations.find((c) => c.id === sp.c) ? sp.c : null;
  const { data: msgs } = selected
    ? await supabase.from("ai_messages").select("id, role, content, proposal, proposal_status, created_at").eq("conversation_id", selected).order("created_at")
    : { data: [] };

  const entitled = hasFeature(plan, "ai_coach");
  let disabledReason: string | null = null;
  if (!isAiConfigured()) disabledReason = "The AI coach isn't configured on this server yet (no AI provider key). Everything else in the app works normally.";
  else if (!flag) disabledReason = "The AI coach is temporarily unavailable.";
  else if (!isServiceRoleConfigured()) disabledReason = "AI usage metering isn't configured on this server, so the coach is disabled.";
  else if (!entitled) disabledReason = "AI coaching is included with Plus and Pro.";
  else if (usage.chatUsed >= usage.chatLimit) disabledReason = `You've used all ${usage.chatLimit} AI messages for this month. Your allowance resets on the 1st.`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Coach"
        title="Your AI coach"
        description="Personalized answers from your goals, equipment and training history."
        actions={
          <>
            {!entitled && (
              <Button asChild>
                <Link href="/profile/billing">Upgrade</Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href="/coach">
                <MessageSquarePlus aria-hidden /> New chat
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Conversations" className="hidden lg:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">History</p>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id as string}>
                  <Link
                    href={`/coach?c=${c.id}`}
                    aria-current={c.id === selected ? "page" : undefined}
                    className={cn("block truncate rounded-xl px-3 py-2 text-sm", c.id === selected ? "bg-gold/10 text-gold-highlight" : "text-muted-foreground hover:bg-elevated hover:text-foreground")}
                  >
                    {c.title as string}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
        <CoachChat
          key={selected ?? "new"}
          conversationId={selected}
          initialMessages={(msgs ?? []) as ChatMessage[]}
          initialQuestion={selected ? "" : (sp.q ?? "").slice(0, 500)}
          enabled={!disabledReason}
          disabledReason={disabledReason}
          canGeneratePlans={hasFeature(plan, "ai_plan_generation")}
          usage={{ used: usage.chatUsed, limit: usage.chatLimit }}
          exerciseNames={Object.fromEntries((exRes.data ?? []).map((e) => [e.slug as string, e.name as string]))}
        />
      </div>
    </div>
  );
}
