import "server-only";
import { isSealed, openWithKey, parseSealKey, sealWithKey } from "@/lib/crypto/memory-seal";
import { logError } from "@/server/log";

/**
 * Field encryption for coaching memories (the long-lived notes the coach keeps about a member: goals, preferences,
 * and, with health-data consent, recovery notes such as an old injury). On top of the database's own encryption at
 * rest, each memory's text is sealed with AES-256-GCM under a server-only key, with the owner's user id as associated
 * data: a database dump, a backup, a log line or a row copied to another account reveals nothing readable. Only the
 * server (with MEMORY_ENCRYPTION_KEY) can read memories; members read theirs through the app.
 *
 * Format: `enc:v1:<12-byte IV, base64>:<ciphertext + 16-byte tag, base64>`. Rows written before encryption (plain text)
 * still read, and scripts/encrypt-memories.ts seals them in place.
 *
 * Without a key, production refuses to store memories (memoryEncryptionReady is false) rather than store them in the
 * clear; development and tests may run without one.
 */
function key(): Buffer | null {
  const raw = process.env.MEMORY_ENCRYPTION_KEY;
  if (!raw) return null;
  const k = parseSealKey(raw);
  if (!k) logError("memory.key_invalid", new Error("MEMORY_ENCRYPTION_KEY must be 32 bytes, base64-encoded"));
  return k;
}

/** Whether memories may be stored: always with a valid key; without one, only outside production. */
export function memoryEncryptionReady(): boolean {
  return key() !== null || process.env.NODE_ENV !== "production";
}

export { isSealed };

/** Seal a memory's text for its owner. Without a key (development only) the text is stored as is. */
export function sealMemory(plain: string, userId: string): string {
  const k = key();
  if (!k) {
    if (process.env.NODE_ENV === "production") throw new Error("MEMORY_ENCRYPTION_KEY is not configured");
    return plain;
  }
  return sealWithKey(plain, userId, k);
}

/** The readable text of a stored memory, or null when it can't be opened (wrong owner, wrong key, damaged). */
export function openMemory(stored: string, userId: string): string | null {
  return openWithKey(stored, userId, key());
}

/** Open a list of memory rows for their owner, dropping any that can't be read (never shown as gibberish). */
export function openMemories<T extends { content: string }>(rows: T[], userId: string): T[] {
  const out: T[] = [];
  for (const r of rows) {
    const text = openMemory(r.content, userId);
    if (text === null) {
      logError("memory.unreadable", new Error("A coaching memory could not be opened"));
      continue;
    }
    out.push({ ...r, content: text });
  }
  return out;
}
