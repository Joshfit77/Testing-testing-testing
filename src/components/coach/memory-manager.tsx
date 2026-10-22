"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Brain, Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/common/states";
import { confirmDialog } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";
import { MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS, MEMORY_LIMIT, MEMORY_MAX_CHARS, type CoachMemory, type MemoryCategory } from "@/lib/coach/memory";
import {
  addCoachMemoryAction,
  deleteAllCoachMemoriesAction,
  deleteCoachMemoryAction,
  setCoachMemoryEnabledAction,
  updateCoachMemoryAction,
} from "@/server/actions/coach-memory";

type Result = { ok: true; message: string } | { ok: false; error: string };

const SOURCE_LABEL: Record<CoachMemory["source"], string> = {
  coach: "suggested by the coach",
  member: "added by you",
  approved_change: "a change you confirmed",
};

function MemoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { category: MemoryCategory; content: string };
  submitLabel: string;
  onSubmit: (v: { category: MemoryCategory; content: string }) => Promise<Result>;
  onCancel?: () => void;
}) {
  const [category, setCategory] = useState<MemoryCategory>(initial?.category ?? "exercise_preferences");
  const [content, setContent] = useState(initial?.content ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await onSubmit({ category, content });
          if (!r.ok) setError(r.error);
          else if (!initial) setContent("");
        });
      }}
    >
      <label className="block text-xs text-muted-foreground">
        Type
        <NativeSelect value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)} className="mt-1">
          {MEMORY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {MEMORY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="block text-xs text-muted-foreground">
        What should the coach remember?
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MEMORY_MAX_CHARS}
          rows={2}
          className="mt-1 text-sm"
          placeholder="e.g. Trains at 6 am before work; sessions must fit in 50 minutes."
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-[#f08a8a]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || content.trim().length < 3}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            <X aria-hidden /> Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function MemoryManager({
  entitled,
  enabled,
  consentAt,
  wellnessConsent,
  memories,
}: {
  entitled: boolean;
  enabled: boolean;
  consentAt: string | null;
  wellnessConsent: boolean;
  memories: CoachMemory[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setNotice(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        setEditingId(null);
        router.refresh();
      }
    });

  const grouped = MEMORY_CATEGORIES.map((c) => ({ category: c, items: memories.filter((m) => m.category === c) })).filter((g) => g.items.length);

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-gold-muted/60 bg-card p-5" aria-labelledby="memory-setting">
        <h2 id="memory-setting" className="flex items-center gap-2 text-lg font-semibold">
          <Brain className="size-5 text-gold" aria-hidden /> Memory is {enabled ? "on" : "off"}
        </h2>
        {!entitled ? (
          <>
            <p className="text-sm text-muted-foreground">Coaching memory is part of the AI Coach, included with Pro. You can still read and delete anything saved earlier.</p>
            <Button asChild size="sm">
              <Link href="/profile/billing">See plans</Link>
            </Button>
          </>
        ) : enabled ? (
          <>
            <p className="text-sm text-muted-foreground">
              The coach uses these notes in every conversation and may suggest new ones. Nothing is saved unless you tap Save. In any chat you can untick
              &ldquo;Coach may suggest things to remember from this chat&rdquo;.
              {consentAt ? ` Turned on ${new Date(consentAt).toLocaleDateString()}.` : ""}
            </p>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setCoachMemoryEnabledAction(false))}>
              Turn memory off
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">With memory on, the coach can keep short notes you approve, such as:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>goals beyond your main one, and milestones you reach</li>
              <li>exercises you like or avoid, when and where you train</li>
              <li>food preferences, recovery preferences and how you like to be coached</li>
              <li>changes you confirmed, and why</li>
            </ul>
            <p className="flex gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
              <span>
                Memories are private to your account and sent to the AI provider (Anthropic) with your coach messages, under the AI data consent you already gave.
                The coach won&apos;t keep health or medical details or anything from your prayer journal. Recovery notes are only used while you share wellness
                information{wellnessConsent ? "" : " (currently off)"}. Your profile, logs and program are read fresh each time and are never copied here. Turning
                memory off stops using it; deleting your account deletes every memory.
              </span>
            </p>
            <Button size="sm" disabled={pending} onClick={() => run(() => setCoachMemoryEnabledAction(true))}>
              Turn memory on
            </Button>
          </>
        )}
      </section>

      {notice && (
        <Notice tone={notice.ok ? "success" : "error"}>
          <span role={notice.ok ? "status" : "alert"}>{notice.text}</span>
        </Notice>
      )}

      {entitled && enabled && (
        <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="memory-add">
          <h2 id="memory-add" className="mb-3 flex items-center gap-2 font-semibold">
            <Plus className="size-4 text-gold" aria-hidden /> Add a memory
          </h2>
          <MemoryForm submitLabel="Save" onSubmit={async (v) => {
            const r = await addCoachMemoryAction(v);
            setNotice(r.ok ? { ok: true, text: r.message } : null);
            if (r.ok) router.refresh();
            return r;
          }} />
        </section>
      )}

      <section aria-labelledby="memory-list" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="memory-list" className="font-semibold">
            Saved memories{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({memories.length}/{MEMORY_LIMIT})
            </span>
          </h2>
          {memories.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Delete every memory?",
                  message: "The coach will forget all of these notes. This can't be undone.",
                  confirmLabel: "Delete all",
                  destructive: true,
                });
                if (ok) run(() => deleteAllCoachMemoriesAction());
              }}
            >
              <Trash2 aria-hidden /> Delete all
            </Button>
          )}
        </div>
        {memories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nothing saved yet.</p>
        ) : (
          grouped.map((g) => (
            <div key={g.category} className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gold">{MEMORY_CATEGORY_LABELS[g.category]}</h3>
              <ul className="mt-2 divide-y divide-border">
                {g.items.map((m) => (
                  <li key={m.id} className="py-3" data-testid="coach-memory">
                    {editingId === m.id ? (
                      <MemoryForm
                        initial={{ category: m.category, content: m.content }}
                        submitLabel="Save changes"
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (v) => {
                          const r = await updateCoachMemoryAction(m.id, v);
                          if (r.ok) {
                            setEditingId(null);
                            setNotice({ ok: true, text: r.message });
                            router.refresh();
                          }
                          return r;
                        }}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm">{m.content}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString()} · {SOURCE_LABEL[m.source]}
                            {m.category === "recovery" && !wellnessConsent && <Badge variant="secondary">not used: wellness sharing is off</Badge>}
                          </p>
                        </div>
                        <div className={cn("flex shrink-0 gap-1")}>
                          {entitled && enabled && (
                            <Button size="icon-sm" variant="ghost" aria-label={`Edit memory: ${m.content.slice(0, 40)}`} onClick={() => setEditingId(m.id)}>
                              <Pencil aria-hidden />
                            </Button>
                          )}
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending}
                            aria-label={`Delete memory: ${m.content.slice(0, 40)}`}
                            onClick={() => run(() => deleteCoachMemoryAction(m.id))}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
