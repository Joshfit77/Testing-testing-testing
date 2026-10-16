"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, Check, ClipboardList, Loader2, MessageSquare, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/common/states";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/domain/units";
import type { AiPlan } from "@/lib/validation/ai";
import { applyProposalAction, deleteConversationAction, dismissProposalAction } from "@/server/actions/coach";
import { Markdown } from "./markdown";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal: AiPlan | null;
  proposal_status: "proposed" | "applied" | "dismissed" | null;
  created_at: string;
}

interface Props {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialQuestion: string;
  enabled: boolean;
  disabledReason: string | null;
  canGeneratePlans: boolean;
  usage: { used: number; limit: number };
  exerciseNames: Record<string, string>;
}

const SUGGESTIONS = [
  "How should I progress my main lifts over the next month?",
  "Suggest alternatives to barbell back squats",
  "Explain how to brace properly for deadlifts",
  "I'm sore and tired today — how should I adjust my workout?",
  "How much protein should I aim for?",
  "Review my training consistency",
];

function PlanPreview({ message, names, onChange }: { message: ChatMessage; names: Record<string, string>; onChange: (status: ChatMessage["proposal_status"]) => void }) {
  const plan = message.proposal!;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; slug?: string } | null>(null);
  const act = (fn: () => Promise<{ ok: true; message: string; programSlug?: string } | { ok: false; error: string }>, status: ChatMessage["proposal_status"]) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setResult({ ok: true, text: r.message, slug: r.programSlug });
        onChange(status);
      } else setResult({ ok: false, text: r.error });
    });
  return (
    <div className="mt-3 rounded-2xl border border-gold-muted/60 bg-[#141210] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
            <ClipboardList className="size-4" aria-hidden /> Proposed plan — review before saving
          </p>
          <p className="mt-1 font-display text-xl font-bold uppercase">{plan.name}</p>
          <p className="text-sm text-muted-foreground">{plan.summary}</p>
        </div>
        {message.proposal_status !== "proposed" && <Badge variant={message.proposal_status === "applied" ? "success" : "secondary"}>{message.proposal_status}</Badge>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">{plan.weeks} weeks</Badge>
        <Badge variant="secondary">{plan.days.length} days / week</Badge>
        <Badge variant="secondary">~{plan.session_minutes} min</Badge>
        <Badge variant="secondary">{plan.difficulty}</Badge>
      </div>
      <ol className="mt-3 space-y-3">
        {plan.days.map((d, i) => (
          <li key={i} className="rounded-xl bg-elevated/60 p-3">
            <p className="text-sm font-semibold">
              Day {i + 1}: {d.name} <span className="font-normal text-muted-foreground">· {d.focus}</span>
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {d.exercises.map((e, j) => (
                <li key={j}>
                  <span className="text-foreground">{names[e.exercise_slug] ?? e.exercise_slug}</span> — {e.sets} × {e.reps ?? (e.seconds ? formatDuration(e.seconds) : "")}
                  {e.rpe ? ` @ RPE ${e.rpe}` : ""}, rest {e.rest_seconds}s{e.notes ? ` · ${e.notes}` : ""}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Progression:</strong> {plan.progression}
      </p>
      {message.proposal_status === "proposed" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => act(() => applyProposalAction(message.id, true), "applied")}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Approve &amp; start
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => applyProposalAction(message.id, false), "applied")}>
            Save for later
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => dismissProposalAction(message.id), "dismissed")}>
            <X aria-hidden /> Dismiss
          </Button>
        </div>
      )}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={cn("mt-2 text-sm", result.ok ? "text-[#5fc49a]" : "text-[#f08a8a]")}>
          {result.text}{" "}
          {result.slug && (
            <Link href={`/train/programs/${result.slug}`} className="underline">
              View program
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

export function CoachChat({ conversationId: initialId, initialMessages, initialQuestion, enabled, disabledReason, canGeneratePlans, usage: initialUsage, exerciseNames }: Props) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState(initialQuestion);
  const [mode, setMode] = useState<"chat" | "plan">("chat");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState(initialUsage);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: message, proposal: null, proposal_status: null, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    setInput("");
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, message, mode }) });
      const json = await res.json();
      if (!res.ok) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setInput(message);
        setError(json.message ?? "Something went wrong. Please try again.");
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), json.userMessage, json.assistantMessage]);
      setUsage(json.usage);
      if (!conversationId) {
        setConversationId(json.conversationId);
        router.replace(`/coach?c=${json.conversationId}`, { scroll: false });
        router.refresh();
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(message);
      setError(navigator.onLine ? "Couldn't reach the server. Please try again." : "You're offline. The AI coach needs a connection.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[60dvh] flex-col rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex gap-1 rounded-xl border border-border bg-background p-1" role="tablist" aria-label="Coach mode">
          <button
            role="tab"
            aria-selected={mode === "chat"}
            onClick={() => setMode("chat")}
            className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold", mode === "chat" ? "bg-elevated text-gold-highlight" : "text-muted-foreground")}
          >
            <MessageSquare className="size-4" aria-hidden /> Ask
          </button>
          <button
            role="tab"
            aria-selected={mode === "plan"}
            onClick={() => canGeneratePlans && setMode("plan")}
            disabled={!canGeneratePlans}
            title={canGeneratePlans ? undefined : "Plan generation is included with Pro"}
            className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50", mode === "plan" ? "bg-elevated text-gold-highlight" : "text-muted-foreground")}
          >
            <Sparkles className="size-4" aria-hidden /> Plan {!canGeneratePlans && <span className="text-[10px] uppercase">Pro</span>}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {usage.limit > 0 && (
            <span className="text-xs text-muted-foreground">
              {usage.used}/{usage.limit} messages this month
            </span>
          )}
          {conversationId && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete conversation"
              onClick={async () => {
                await deleteConversationAction(conversationId);
                router.push("/coach");
                router.refresh();
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold/10 text-gold">
              <Bot className="size-7" aria-hidden />
            </div>
            <p className="mt-3 font-display text-xl font-semibold uppercase">How can I help you train?</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              I use your goals, equipment and logged workouts to give specific advice. {canGeneratePlans ? "Switch to Plan mode to draft a new program you can review before saving." : ""}
            </p>
            <div className="mx-auto mt-5 grid max-w-2xl gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} disabled={!enabled} onClick={() => send(s)} className="rounded-xl border border-border bg-elevated/60 px-3 py-2.5 text-left text-sm hover:border-gold-muted disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-2xl px-4 py-3 md:max-w-[80%]", m.role === "user" ? "bg-gold/15 text-foreground" : "border border-border bg-elevated/70")}>
              {m.role === "assistant" ? <Markdown text={m.content} /> : <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
              {m.proposal && (
                <PlanPreview
                  message={m}
                  names={exerciseNames}
                  onChange={(status) => setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, proposal_status: status } : x)))}
                />
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {mode === "plan" ? "Drafting your plan — this can take a little while…" : "Thinking…"}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        {!enabled && disabledReason && <Notice tone="info" className="mb-3">{disabledReason}</Notice>}
        {error && <Notice tone="error" className="mb-3">{error}</Notice>}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="coach-input" className="sr-only">
            Message the AI coach
          </label>
          <Textarea
            id="coach-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            disabled={!enabled}
            maxLength={4000}
            rows={2}
            className="min-h-12 resize-none"
            placeholder={mode === "plan" ? "Describe the plan you want (goal, days, equipment, focus)…" : "Ask about training, technique, recovery or nutrition…"}
          />
          <Button type="submit" size="icon" disabled={!enabled || sending || !input.trim()} aria-label="Send message">
            {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          </Button>
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">
          AI responses can be wrong and are not medical advice. Don&apos;t share sensitive health details you don&apos;t want stored. Stop any exercise that causes pain.
        </p>
      </div>
    </div>
  );
}
