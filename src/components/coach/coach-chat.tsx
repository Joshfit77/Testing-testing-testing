"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Bot, Check, CheckCircle2, ClipboardList, Copy, Loader2, MessageSquare, RotateCcw, Search, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/common/states";
import { confirmDialog } from "@/components/ui/confirm";
import { prefersReducedMotion } from "@/lib/keyboard";
import { DraftRestoredNotice } from "@/components/drafts/draft-notice";
import { clearDraft, readDraft, writeDraft } from "@/lib/drafts";
import { useDraft, useDraftUserId } from "@/lib/use-draft";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/domain/units";
import type { AiPlan } from "@/lib/validation/ai";
import type { CoachProposal } from "@/lib/coach/tools";
import { applyProposalAction, deleteConversationAction, dismissProposalAction } from "@/server/actions/coach";
import { setConversationMemoryOffAction } from "@/server/actions/coach-memory";
import { chatCreated, initialChatKey, nextChatKey } from "@/lib/coach/chat-key";

/** A random id for one message (RFC 4122 v4), also where crypto.randomUUID isn't available. */
export function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
import { Markdown } from "./markdown";
import { SuggestionCard } from "./suggestion-card";
import { CoachFeedback } from "./coach-feedback";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal: AiPlan | CoachProposal | null;
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
  /** Starter questions built from the user's own data. */
  suggestions?: string[];
  /** Coaching memory (Pro): whether it's on, and whether this chat is "don't remember". Null without the AI coach. */
  memory?: { enabled: boolean; chatOff: boolean } | null;
  /** TestFlight "Was this coaching advice useful?" under replies: only when the owner has switched it on. */
  feedbackEnabled?: boolean;
}

/** Keeps a new chat on screen while it moves to its own URL; another chat, or "New chat", starts fresh (see chat-key). */
export function CoachChat(props: Props) {
  const [chat, setChat] = useState(() => initialChatKey(props.conversationId));
  const next = nextChatKey(chat, props.conversationId);
  if (next !== chat) setChat(next);
  return <CoachChatView key={next.key} {...props} onCreated={(id) => setChat((c) => chatCreated(c, id))} />;
}

/** "Today at 9:24 AM", "Yesterday at 6:10 PM", or "Nov 3 at 7:00 AM": when a message was sent, in the member's clock. */
function messageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay(d, now)) return `Today at ${time}`;
  if (sameDay(d, yesterday)) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${time}`;
}

const subscribeNever = () => () => {};
/**
 * The time stamp under a message, rendered in the browser only: the server runs on its own clock and time zone, so text
 * built from "now" there would differ from the member's and break hydration (React #418). Empty on the server pass.
 */
function MessageTime({ iso }: { iso?: string }) {
  const label = useSyncExternalStore(subscribeNever, () => messageTime(iso ?? new Date().toISOString()), () => "");
  return <p className="mt-1 min-h-4 px-1 text-xs text-muted-foreground">{label}</p>;
}

/** The coach's gold medallion beside its messages. */
function CoachAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-black shadow-bronze", className)} aria-hidden>
      <Bot className="size-5" />
    </span>
  );
}

const DEFAULT_SUGGESTIONS = [
  "Why did my bench stall?",
  "Plan my deload",
  "What should I eat before my workout today?",
  "Suggest alternatives to barbell back squats",
  "How much protein should I aim for?",
  "Review my training consistency",
];

function PlanPreview({ message, names, onChange }: { message: ChatMessage; names: Record<string, string>; onChange: (status: ChatMessage["proposal_status"]) => void }) {
  const plan = message.proposal as AiPlan;
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

const isCoachProposal = (p: ChatMessage["proposal"]): p is CoachProposal => Boolean(p && typeof p === "object" && "kind" in p);

interface Activity {
  label: string;
  done: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground"
      aria-label={copied ? "Copied" : "Copy reply"}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ActivityList({ items, status }: { items: Activity[]; status: string | null }) {
  if (!items.length && !status) return null;
  return (
    <ul className="space-y-1 text-xs text-muted-foreground" aria-label="Coach activity" data-testid="coach-activity">
      {items.map((a, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {a.done ? <CheckCircle2 className="size-3.5 text-gold" aria-hidden /> : <Search className="size-3.5 animate-pulse text-gold" aria-hidden />}
          {a.label}
        </li>
      ))}
      {status && !items.some((a) => !a.done) && (
        <li className="flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> {status}
        </li>
      )}
    </ul>
  );
}

type StreamEvent =
  | { type: "status"; text: string }
  | { type: "tool"; name: string; label: string }
  | { type: "text"; delta: string }
  | { type: "reset" }
  | { type: "done"; result: { conversationId: string; userMessage: ChatMessage; assistantMessage: ChatMessage; usage: { used: number; limit: number } } }
  | { type: "error"; message?: string };

function CoachChatView({ conversationId: initialId, initialMessages, initialQuestion, enabled, disabledReason, canGeneratePlans, usage: initialUsage, exerciseNames, suggestions, memory, feedbackEnabled, onCreated }: Props & { onCreated: (id: string) => void }) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  // The unsent message is a draft on this device (per user and conversation): it survives tab switches,
  // reloads and failed sends (429/500/offline) until the coach has replied.
  const draftKey = `coach.input.${conversationId ?? "new"}`;
  const userId = useDraftUserId();
  const inputDraft = useDraft(draftKey, "");
  const input = inputDraft.value;
  const setInput = inputDraft.setValue;
  const [restoredNotice, setRestoredNotice] = useState(false);
  const [mode, setMode] = useState<"chat" | "plan">("chat");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [memoryOff, setMemoryOff] = useState(Boolean(memory?.chatOff));
  const [memoryNote, setMemoryNote] = useState<string | null>(null);
  const [usage, setUsage] = useState(initialUsage);
  const [draft, setDraft] = useState("");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const starters = suggestions?.length ? suggestions : DEFAULT_SUGGESTIONS;
  const pendingKey = "coach.pending";
  // The id of the message being sent, kept until it is answered: sending the same text again (after a dropped
  // connection, or after reopening the page) reuses it, so the server returns the reply it already saved instead
  // of answering, and charging, twice.
  const retryRef = useRef<{ message: string; requestId: string } | null>(null);

  // A link like /coach?q=… prefills the box (it wins over an older draft).
  useEffect(() => {
    if (initialQuestion) setInput(initialQuestion);
    // A message that was being sent when the page closed: bring it back unless it was saved.
    const pending = readDraft<{ message: string; conversationId: string | null; requestId?: string }>(userId, pendingKey);
    if (!pending) return;
    clearDraft(userId, pendingKey);
    const p = pending.value;
    const saved = initialMessages.some((m) => m.role === "user" && m.content === p.message);
    if (!saved && p.conversationId === initialId) {
      setInput((cur) => (cur.trim() ? cur : p.message));
      setRestoredNotice(true);
      if (p.requestId) retryRef.current = { message: p.message, requestId: p.requestId };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  const showRestored = restoredNotice || inputDraft.restored;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "end" });
  }, [messages, sending, draft, activity.length]);

  const finish = (json: Extract<StreamEvent, { type: "done" }>["result"], optimisticId: string) => {
    clearDraft(userId, pendingKey);
    retryRef.current = null;
    setMessages((m) => [...m.filter((x) => x.id !== optimisticId), json.userMessage, json.assistantMessage]);
    setUsage(json.usage);
    if (!conversationId) {
      setConversationId(json.conversationId);
      onCreated(json.conversationId);
      router.replace(`/coach?c=${json.conversationId}`, { scroll: false });
      router.refresh();
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    setActivity([]);
    setStatus(mode === "plan" ? "Drafting your plan — this can take a little while…" : "Thinking…");
    const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: message, proposal: null, proposal_status: null, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    const requestId = retryRef.current?.message === message ? retryRef.current.requestId : newRequestId();
    retryRef.current = { message, requestId };
    // Keep the message on the device until the coach has answered.
    writeDraft(userId, pendingKey, { message, conversationId, requestId });
    setInput("");
    setRestoredNotice(false);
    inputDraft.dismissRestored();
    const fail = (msg: string) => {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      clearDraft(userId, pendingKey);
      setInput(message);
      setError(msg);
    };
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ conversationId, message, mode, requestId, ...(conversationId ? {} : { memoryOff }) }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        fail(json.message ?? "Something went wrong. Please try again.");
        return;
      }
      if (!(res.headers.get("content-type") ?? "").includes("ndjson")) {
        finish(await res.json(), optimistic.id);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      const handle = (e: StreamEvent) => {
        if (e.type === "status") setStatus(e.text);
        else if (e.type === "tool") setActivity((a) => [...a.map((x) => ({ ...x, done: true })), { label: e.label, done: false }]);
        else if (e.type === "text") {
          setActivity((a) => a.map((x) => ({ ...x, done: true })));
          setDraft((d) => d + e.delta);
        } else if (e.type === "reset") setDraft("");
        else if (e.type === "done") {
          done = true;
          finish(e.result, optimistic.id);
        } else if (e.type === "error") {
          done = true;
          fail(e.message ?? "Something went wrong. Please try again.");
        }
      };
      for (;;) {
        const { value, done: eof } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) {
            try {
              handle(JSON.parse(line) as StreamEvent);
            } catch {
              /* ignore a malformed line */
            }
          }
        }
        if (eof) break;
      }
      if (!done) fail("The connection dropped before the coach finished. Please try again.");
    } catch {
      fail(navigator.onLine ? "Couldn't reach the server. Please try again." : "You're offline. The AI coach needs a connection.");
    } finally {
      setSending(false);
      setDraft("");
      setActivity([]);
      setStatus(null);
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
            className={cn("flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold", mode === "chat" ? "bg-elevated text-gold-highlight" : "text-muted-foreground")}
          >
            <MessageSquare className="size-4" aria-hidden /> Ask
          </button>
          <button
            role="tab"
            aria-selected={mode === "plan"}
            onClick={() => canGeneratePlans && setMode("plan")}
            disabled={!canGeneratePlans}
            title={canGeneratePlans ? undefined : "Plan generation is included with Pro All Access"}
            className={cn("flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50", mode === "plan" ? "bg-elevated text-gold-highlight" : "text-muted-foreground")}
          >
            <Sparkles className="size-4" aria-hidden /> Plan {!canGeneratePlans && <span className="text-xs uppercase">Pro</span>}
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
                const ok = await confirmDialog({
                  title: "Delete this conversation?",
                  message: "The messages are removed from your account. Changes you already confirmed stay in place.",
                  confirmLabel: "Delete",
                  destructive: true,
                });
                if (!ok || deleting) return;
                setDeleting(true);
                try {
                  const res = await deleteConversationAction(conversationId);
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  router.push("/coach");
                  router.refresh();
                } catch {
                  setError("Couldn't delete the conversation. Check your connection and try again.");
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* Screen readers hear each finished reply once (below), not the streamed text as it arrives. */}
      <p className="sr-only" aria-live="polite">
        {!sending && messages.at(-1)?.role === "assistant" ? `Coach replied: ${messages.at(-1)!.content.slice(0, 600)}` : ""}
      </p>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <CoachAvatar />
              <div className="min-w-0">
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-elevated/70 px-4 py-3 md:max-w-[80%]">
                  <p className="font-display text-lg font-semibold">How can I help you train?</p>
                  <p className="mt-1 text-sm text-foreground/85">
                    I read your goals, program, workouts, food log and bodyweight to give specific advice, and I can suggest changes for you to confirm.{" "}
                    {canGeneratePlans ? "Switch to Plan mode to draft a new program you can review before saving." : ""}
                  </p>
                </div>
                <MessageTime />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-11" aria-label="Suggested questions">
              {starters.map((s) => (
                <button
                  key={s}
                  disabled={!enabled}
                  onClick={() => send(s)}
                  className="min-h-11 rounded-full border border-gold-muted/70 bg-[#141209] px-4 py-2 text-left text-sm font-medium text-gold-highlight hover:border-gold disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex items-end gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && <CoachAvatar />}
            <div className={cn("min-w-0 max-w-[92%] md:max-w-[80%]", m.role === "user" && "flex flex-col items-end")}>
            <div className={cn("rounded-2xl px-4 py-3", m.role === "user" ? "rounded-br-md bg-gold-gradient text-black" : "rounded-bl-md border border-border bg-elevated/70")} data-testid={m.role === "assistant" ? "coach-reply" : undefined}>
              {m.role === "assistant" ? <Markdown text={m.content} /> : <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
              {m.proposal &&
                (isCoachProposal(m.proposal) ? (
                  <SuggestionCard
                    messageId={m.id}
                    proposal={m.proposal}
                    status={m.proposal_status}
                    onChange={(s) => setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, proposal_status: s } : x)))}
                  />
                ) : (
                  <PlanPreview
                    message={m}
                    names={exerciseNames}
                    onChange={(s) => setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, proposal_status: s } : x)))}
                  />
                ))}
              {m.role === "assistant" && (
                <div className="mt-1 flex justify-end">
                  <CopyButton text={m.content} />
                </div>
              )}
              {feedbackEnabled && m.role === "assistant" && !m.id.startsWith("tmp-") && <CoachFeedback messageId={m.id} />}
            </div>
            <MessageTime iso={m.created_at} />
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-end gap-2" aria-busy="true">
            <CoachAvatar />
            <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-md border border-border bg-elevated/70 px-4 py-3 md:max-w-[80%]">
              <ActivityList items={activity} status={draft ? null : status} />
              {draft && <Markdown text={draft} />}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        {!enabled && disabledReason && <Notice tone="info" className="mb-3">{disabledReason}</Notice>}
        {error && (
          <Notice tone="error" className="mb-3">
            <span className="block">{error}</span>
            <span className="mt-1 block text-xs">Your message is still in the box below.</span>
            {enabled && input.trim() && (
              <Button type="button" size="sm" variant="secondary" className="mt-2" disabled={sending} onClick={() => void send(input)}>
                <RotateCcw aria-hidden /> Try again
              </Button>
            )}
          </Notice>
        )}
        {showRestored && !error && input.trim() !== "" && (
          <div className="mb-3">
            <DraftRestoredNotice
              label="Unsent message restored"
              onDiscard={() => {
                setRestoredNotice(false);
                inputDraft.clear();
              }}
              onDismiss={() => {
                setRestoredNotice(false);
                inputDraft.dismissRestored();
              }}
            />
          </div>
        )}
        <form
          className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-[#101010] p-1.5 pl-4 focus-within:border-gold-muted"
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
            rows={1}
            className="max-h-40 min-h-11 resize-none border-0 bg-transparent px-0 py-2.5 text-base shadow-none focus-visible:ring-0"
            placeholder={mode === "plan" ? "Describe the plan you want (goal, days, equipment, focus)…" : "Ask your coach…"}
          />
          <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" disabled={!enabled || sending || !input.trim()} aria-label="Send message">
            {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send className="ml-0.5 size-5" aria-hidden />}
          </Button>
        </form>
        {memory?.enabled && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-[#C9A54C]"
                checked={!memoryOff}
                onChange={async (e) => {
                  const off = !e.target.checked;
                  setMemoryOff(off);
                  setMemoryNote(null);
                  if (!conversationId) return;
                  const r = await setConversationMemoryOffAction(conversationId, off);
                  if (!r.ok) {
                    setMemoryOff(!off);
                    setMemoryNote(r.error);
                  }
                }}
              />
              Coach may suggest things to remember from this chat
            </label>
            <Link href="/coach/memory" className="underline">
              Memory
            </Link>
            {memoryNote && <span role="alert" className="text-[#f08a8a]">{memoryNote}</span>}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          You&apos;re chatting with an AI. Its answers can be wrong, incomplete or out of date, and it isn&apos;t a doctor, dietitian or physical therapist; this
          is not medical advice. Suggested changes only apply when you tap Confirm. Don&apos;t share sensitive health details you don&apos;t want stored. Stop any exercise that causes pain.
        </p>
      </div>
    </div>
  );
}
