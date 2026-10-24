import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers without signing in and is never cached", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("NGF_BUILD_SHA", "");
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: { app: "narrow-gate-fitness", commit: "" } });
  });

  it("reports the deployed commit", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc1234");
    expect((await GET().json()).data.commit).toBe("abc1234");
  });
});
