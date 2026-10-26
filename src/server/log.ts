import "server-only";

/**
 * Structured error logging that avoids leaking private data: only error names, codes and
 * messages are logged — never request bodies, health data, journal text or tokens.
 */
export function logError(scope: string, error: unknown, context: Record<string, string | number | boolean | null> = {}) {
  const e = error as { name?: string; message?: string; code?: string | number; status?: number };
  console.error(
    JSON.stringify({
      level: "error",
      scope,
      name: e?.name ?? "Error",
      code: e?.code ?? null,
      status: e?.status ?? null,
      message: typeof e?.message === "string" ? e.message.slice(0, 300) : String(error).slice(0, 300),
      ...context,
      at: new Date().toISOString(),
    }),
  );
}

/** A notable event that isn't an error (same privacy rules as logError: ids and codes only). */
export function logInfo(scope: string, context: Record<string, string | number | boolean | null> = {}) {
  console.info(JSON.stringify({ level: "info", scope, ...context, at: new Date().toISOString() }));
}
