"use client";

import { useSafeTransition } from "@/lib/use-safe-transition";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { confirmDialog } from "@/components/ui/confirm";
import { categoryById, type CategoryId } from "@/lib/biblical-ai/config";
import { askHref } from "@/lib/biblical-ai/links";
import { deleteAllConversationsAction, deleteConversationAction, renameConversationAction } from "@/server/actions/biblical-ai";

export interface ConversationRow {
  id: string;
  title: string;
  category: CategoryId;
  passage: string | null;
  updatedAt: string;
}

/** The member's Biblical AI conversations: open, rename, delete one, or delete all. */
export function ConversationList({ conversations }: { conversations: ConversationRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(conversations);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [pending, start] = useSafeTransition();

  if (!rows.length) return <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Your studies will appear here.</p>;

  return (
    <div className="space-y-2">
      <ul className="space-y-2" data-testid="biblical-ai-conversations">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-4">
            {editing === c.id ? (
              <form
                className="flex flex-1 items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const r = await renameConversationAction(c.id, title);
                    if (!r.ok) return toast.error(r.error);
                    setRows((all) => all.map((x) => (x.id === c.id ? { ...x, title: title.trim() } : x)));
                    setEditing(null);
                  });
                }}
              >
                <label htmlFor={`rename-${c.id}`} className="sr-only">
                  New title for {c.title}
                </label>
                <Input id={`rename-${c.id}`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} autoFocus />
                <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save title" disabled={pending}>
                  <Check aria-hidden />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                  <X aria-hidden />
                </Button>
              </form>
            ) : (
              <>
                <Link href={askHref({ conversation: c.id })} className="min-w-0 flex-1 py-1">
                  <span className="block truncate font-semibold">{c.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {categoryById(c.category)?.title}
                    {c.passage ? ` · ${c.passage}` : ""} · {new Date(c.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Rename ${c.title}`}
                  onClick={() => {
                    setEditing(c.id);
                    setTitle(c.title);
                  }}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${c.title}`}
                  disabled={pending}
                  onClick={async () => {
                    if (!(await confirmDialog({ title: "Delete this study?", message: "The conversation and its answers will be deleted. Answers you saved to your studies are kept.", confirmLabel: "Delete", destructive: true }))) return;
                    start(async () => {
                      const r = await deleteConversationAction(c.id);
                      if (!r.ok) return toast.error(r.error);
                      setRows((all) => all.filter((x) => x.id !== c.id));
                    });
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={async () => {
          if (!(await confirmDialog({ title: "Delete all your Biblical AI conversations?", message: "Every question and answer will be deleted. Saved studies are kept until you delete them.", confirmLabel: "Delete all", destructive: true }))) return;
          start(async () => {
            const r = await deleteAllConversationsAction();
            if (!r.ok) return toast.error(r.error);
            setRows([]);
            router.refresh();
          });
        }}
      >
        <Trash2 aria-hidden /> Delete all conversations
      </Button>
    </div>
  );
}
