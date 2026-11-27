/**
 * Server-side error monitoring (Next.js instrumentation). Every error thrown while rendering a page, running a server
 * action or handling a route is written to the server log as one redacted line: the route pattern, the kind of route,
 * the error's name, digest and scrubbed message. Never the request body, cookies, headers, query or member data
 * (docs/ERROR_MONITORING.md). Writing to the log is free; forwarding it to an alerting service is the host's job.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { redactMessage, redactPath } = await import("@/lib/error-redact");
  const e = error as { name?: string; digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      scope: "server.request",
      name: typeof e?.name === "string" ? e.name : "Error",
      digest: typeof e?.digest === "string" ? e.digest : null,
      message: redactMessage(error),
      route: context.routePath || redactPath(request.path),
      routeType: context.routeType,
      method: request.method,
      at: new Date().toISOString(),
    }),
  );
}
