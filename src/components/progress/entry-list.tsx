import { Trash2 } from "lucide-react";
import { ActionButton, type ActionButtonResult } from "@/components/common/action-button";

export interface Entry {
  id: string;
  date: string;
  value: string;
}

/** How many entries show before "Show all". */
export const ENTRY_PREVIEW = 8;

/**
 * Logged entries (bodyweight, measurements) for the selected range, newest first, each with a delete control. The
 * first few show under "Recent entries"; "Show all" opens the rest, so every entry in the range can be reached.
 */
export function EntryList({ entries, action, noun }: { entries: Entry[]; action: (formData: FormData) => Promise<ActionButtonResult>; noun: string }) {
  if (!entries.length) return null;
  const row = (e: Entry) => (
    <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{e.date}</span>
      <span className="flex min-w-0 items-center gap-2 text-right">
        {e.value}
        <ActionButton action={action} fields={{ id: e.id }} variant="ghost" size="icon-sm" aria-label={`Delete ${noun} for ${e.date}`} confirmMessage={`Delete the ${noun} for ${e.date}?`} confirmLabel="Delete">
          <Trash2 className="size-3.5" />
        </ActionButton>
      </span>
    </li>
  );
  const rest = entries.slice(ENTRY_PREVIEW);
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs text-muted-foreground">Recent entries</summary>
      <ul className="mt-2 space-y-1">{entries.slice(0, ENTRY_PREVIEW).map(row)}</ul>
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground">Show all {entries.length} entries in this period</summary>
          <ul className="mt-1 space-y-1">{rest.map(row)}</ul>
        </details>
      )}
    </details>
  );
}
