import type { FullConfig } from "@playwright/test";
import { startOffMock } from "./off-mock";

/** Starts the shared Open Food Facts mock once for the whole run (several specs use it, possibly in parallel). */
export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const port = Number(process.env.E2E_OFF_MOCK_PORT ?? 0);
  if (!port) return async () => undefined;
  const server = await startOffMock(port);
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
