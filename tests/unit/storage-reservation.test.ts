import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alreadyUploaded, reserveUpload } from "@/lib/storage-reservation";

/** The client half of upload reservations (migration 20261127000097): what the photo screens do with each answer. */
const client = (rpc: (...args: unknown[]) => unknown) => ({ rpc: vi.fn(rpc) }) as unknown as SupabaseClient & { rpc: ReturnType<typeof vi.fn> };

describe("reserveUpload", () => {
  it("asks for exactly the file about to be uploaded", async () => {
    const c = client(async () => ({ data: "ok", error: null }));
    expect(await reserveUpload(c, "progress-photos", "u1/a.jpg")).toBe("ok");
    expect(c.rpc).toHaveBeenCalledWith("reserve_storage_upload", { p_bucket: "progress-photos", p_name: "u1/a.jpg" });
  });

  it("reports a reached limit, so the screen shows the limit message instead of uploading", async () => {
    expect(await reserveUpload(client(async () => ({ data: "limit", error: null })), "body-scans", "u1/s/front.jpg")).toBe("limit");
  });

  it("goes ahead, unchecked, while the database doesn't have the function yet (web app deployed before the migration)", async () => {
    expect(await reserveUpload(client(async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.reserve_storage_upload" } })), "progress-photos", "u1/a.jpg")).toBe("unchecked");
    expect(await reserveUpload(client(async () => ({ data: null, error: { code: "42883", message: "function does not exist" } })), "progress-photos", "u1/a.jpg")).toBe("unchecked");
  });

  it("any other refusal or a dropped request is an error, never a silent pass", async () => {
    expect(await reserveUpload(client(async () => ({ data: null, error: { code: "42501", message: "not a file in your own folder" } })), "progress-photos", "u2/a.jpg")).toBe("error");
    expect(await reserveUpload(client(async () => { throw new TypeError("Failed to fetch"); }), "progress-photos", "u1/a.jpg")).toBe("error");
    expect(await reserveUpload(client(async () => ({ data: "something else", error: null })), "progress-photos", "u1/a.jpg")).toBe("error");
  });
});

describe("alreadyUploaded (a retry after the upload's reply was lost)", () => {
  it("recognises the storage service's 'already exists' answers, and nothing else", () => {
    expect(alreadyUploaded({ statusCode: "409", message: "The resource already exists" })).toBe(true);
    expect(alreadyUploaded({ code: "KeyAlreadyExists", message: "x" })).toBe(true);
    expect(alreadyUploaded({ statusCode: 409 })).toBe(true);
    expect(alreadyUploaded({ statusCode: "403", message: "new row violates row-level security policy" })).toBe(false);
    expect(alreadyUploaded({ message: "Failed to fetch" })).toBe(false);
    expect(alreadyUploaded(null)).toBe(false);
  });
});

describe("the photo screens reserve before every upload", () => {
  it.each(["src/components/progress/progress-photos.tsx", "src/components/body-scan/scan-capture.tsx"])("%s", async (file) => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(file, "utf8");
    const reserve = src.indexOf("await reserveUpload(");
    const upload = src.indexOf(".upload(path");
    expect(reserve).toBeGreaterThan(0);
    expect(upload).toBeGreaterThan(reserve);
    expect(src.match(/\.upload\(/g)?.length).toBe(1);
    // A file already there from a lost reply counts as uploaded; a refusal after a granted reservation isn't the limit.
    expect(src).toContain("upErr && !alreadyUploaded(upErr)");
    expect(src).toMatch(/LIMIT_MESSAGE && reservation === "ok" \? UPLOAD_RETRY_MESSAGE/);
  });
});
