import "server-only";
import { createHash } from "node:crypto";

/**
 * Retry safety, one place. A device gives each save one id (a uuid) and reuses it when it retries that save; tables
 * that take retried writes have a unique index on (user_id, client_id). So:
 * - `isRepeatOf(error, clientId)`: the insert was refused because this same save already landed (Postgres 23505 on a
 *   save that carried an id). Treat it as success and read back what the first attempt wrote.
 * - `derivedClientId(clientId, part)`: one save that writes several rows (a meal photo, a saved meal, a copied day)
 *   gives each row its own id, derived from the save's id and the row's place, the same on every retry.
 */
export function isRepeatOf(error: { code?: string } | null | undefined, clientId: string | null | undefined): boolean {
  return error?.code === "23505" && Boolean(clientId);
}

/** A stable uuid-shaped id for row `part` of the save `clientId` (the same inputs always give the same id). */
export function derivedClientId(clientId: string, part: string | number): string {
  const h = createHash("sha256").update(`${clientId}:${part}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
