import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const exportUserData = vi.fn();
vi.mock("@/server/auth", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
vi.mock("@/server/services/account", () => ({ exportUserData: (...args: unknown[]) => exportUserData(...args) }));
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: async () => ({}) }));
vi.mock("@/server/log", () => ({ logError: vi.fn() }));

const { GET } = await import("@/app/api/account/export/route");

/** The export reads every table the member owns, so it is limited to a few downloads an hour per member. */
describe("GET /api/account/export", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    exportUserData.mockReset();
  });

  it("refuses anonymous requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(exportUserData).not.toHaveBeenCalled();
  });

  it("downloads as a JSON attachment that is never cached", async () => {
    getCurrentUser.mockResolvedValue({ id: "export-user-a", email: "a@example.com" });
    exportUserData.mockResolvedValue({ profile: { id: "export-user-a" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="narrow-gate-fitness-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ profile: { id: "export-user-a" } });
  });

  it("allows three exports an hour per member, then answers 429 with Retry-After", async () => {
    getCurrentUser.mockResolvedValue({ id: "export-user-b", email: "b@example.com" });
    exportUserData.mockResolvedValue({});
    for (let i = 0; i < 3; i++) expect((await GET()).status).toBe(200);
    const blocked = await GET();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(exportUserData).toHaveBeenCalledTimes(3);
    // Another member is not affected by this one's limit.
    getCurrentUser.mockResolvedValue({ id: "export-user-c", email: "c@example.com" });
    expect((await GET()).status).toBe(200);
  });
});
