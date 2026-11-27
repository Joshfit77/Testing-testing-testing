/**
 * The sealing format for coaching memories (no server-only import, so scripts and tests can use it):
 * AES-256-GCM, 12-byte random IV, the owner's user id as associated data, stored as
 * `enc:v1:<iv base64>:<ciphertext + 16-byte tag, base64>`. The server wrapper is src/server/crypto/memory-crypto.ts.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const SEAL_PREFIX = "enc:v1:";

export function isSealed(stored: string): boolean {
  return stored.startsWith(SEAL_PREFIX);
}

/** A 32-byte key from base64, or null when it isn't one. */
export function parseSealKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const k = Buffer.from(raw, "base64");
  return k.length === 32 ? k : null;
}

export function sealWithKey(plain: string, userId: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${SEAL_PREFIX}${iv.toString("base64")}:${body.toString("base64")}`;
}

/** The text, or null if it can't be opened with this key for this owner. Plain (unsealed) text is returned as is. */
export function openWithKey(stored: string, userId: string, key: Buffer | null): string | null {
  if (!isSealed(stored)) return stored;
  if (!key) return null;
  const [ivB64, bodyB64] = stored.slice(SEAL_PREFIX.length).split(":");
  if (!ivB64 || !bodyB64) return null;
  try {
    const body = Buffer.from(bodyB64, "base64");
    if (body.length < 17) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAAD(Buffer.from(userId, "utf8"));
    decipher.setAuthTag(body.subarray(body.length - 16));
    return Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
