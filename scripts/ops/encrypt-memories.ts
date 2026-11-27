/**
 * Seal coaching memories that were stored before memory encryption (migration 069), in place. Idempotent: rows that
 * are already sealed are skipped. Prints counts only, never memory text.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… MEMORY_ENCRYPTION_KEY=… npx tsx scripts/ops/encrypt-memories.ts [--dry-run]
 *   … npx tsx scripts/ops/encrypt-memories.ts --decrypt   (rollback only: opens sealed rows back to plain text)
 */
import { createClient } from "@supabase/supabase-js";
import { isSealed, openWithKey, parseSealKey, sealWithKey } from "../../src/lib/crypto/memory-seal";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const key = parseSealKey(process.env.MEMORY_ENCRYPTION_KEY);
const dryRun = process.argv.includes("--dry-run");
const decrypt = process.argv.includes("--decrypt");
if (!url || !service || !key) {
  console.error("Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and a 32-byte base64 MEMORY_ENCRYPTION_KEY.");
  process.exit(2);
}
const db = createClient(url, service, { auth: { persistSession: false } });

let changed = 0;
let skipped = 0;
let unreadable = 0;
for (let from = 0; ; from += 500) {
  const { data, error } = await db.from("coach_memories").select("id, user_id, content").order("id").range(from, from + 499);
  if (error) throw error;
  for (const row of data ?? []) {
    const sealed = isSealed(row.content as string);
    if (decrypt ? !sealed : sealed) {
      skipped++;
      continue;
    }
    let next: string;
    if (decrypt) {
      const text = openWithKey(row.content as string, row.user_id as string, key);
      if (text === null) {
        unreadable++;
        continue;
      }
      next = text;
    } else {
      next = sealWithKey(row.content as string, row.user_id as string, key);
    }
    if (!dryRun) {
      const { error: upErr } = await db.from("coach_memories").update({ content: next }).eq("id", row.id).eq("content", row.content);
      if (upErr) throw upErr;
    }
    changed++;
  }
  if (!data || data.length < 500) break;
}
console.log(`${decrypt ? "opened" : "sealed"}: ${changed}${dryRun ? " (dry run, nothing written)" : ""}; already ${decrypt ? "plain" : "sealed"}: ${skipped}; unreadable: ${unreadable}`);
