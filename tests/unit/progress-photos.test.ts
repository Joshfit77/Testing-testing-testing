import { comparePhotos, fitWithin, isOwnPhotoPath, PHOTO_LIMIT_MESSAGE, PHOTO_LIMITS, photoPathFor, photoUploadErrorMessage } from "@/lib/domain/progress-photos";

const UID = "6f1c2a7e-1b2c-4d3e-8f90-0123456789ab";
const OTHER = "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d";
const FILE = "1d2e3f40-5a6b-4c7d-9e8f-001122334455";

describe("progress photo paths", () => {
  it("builds paths inside the owner's folder", () => {
    expect(photoPathFor(UID, FILE)).toBe(`${UID}/${FILE}.jpg`);
    expect(isOwnPhotoPath(UID, photoPathFor(UID, FILE))).toBe(true);
  });

  it("rejects other users' folders, traversal and odd names", () => {
    expect(isOwnPhotoPath(UID, `${OTHER}/${FILE}.jpg`)).toBe(false);
    expect(isOwnPhotoPath(UID, `${UID}/../${OTHER}/${FILE}.jpg`)).toBe(false);
    expect(isOwnPhotoPath(UID, `${UID}/sub/${FILE}.jpg`)).toBe(false);
    expect(isOwnPhotoPath(UID, `${UID}/${FILE}.gif`)).toBe(false);
    expect(isOwnPhotoPath(UID, `${UID}/photo.jpg`)).toBe(false);
    expect(isOwnPhotoPath(UID, `x${UID}/${FILE}.jpg`)).toBe(false);
    expect(isOwnPhotoPath("not-a-uuid", `not-a-uuid/${FILE}.jpg`)).toBe(false);
  });
});

describe("fitWithin", () => {
  it("downscales the longest edge to the max and keeps aspect ratio", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it("never upscales", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
  it("handles empty images", () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe("comparePhotos", () => {
  it("orders before/after by date and computes day and weight differences", () => {
    const a = { takenOn: "2026-10-01", weightKg: 90 };
    const b = { takenOn: "2026-08-02", weightKg: 94.5 };
    const r = comparePhotos(a, b);
    expect(r.before).toBe(b);
    expect(r.after).toBe(a);
    expect(r.days).toBe(60);
    expect(r.weightDeltaKg).toBe(-4.5);
  });
  it("has no weight difference when either weight is missing", () => {
    expect(comparePhotos({ takenOn: "2026-10-01", weightKg: null }, { takenOn: "2026-10-02", weightKg: 80 }).weightDeltaKg).toBeNull();
  });
});

describe("photoUploadErrorMessage", () => {
  it("explains the upload limit when storage refuses the upload, and keeps the connection message otherwise", () => {
    expect(photoUploadErrorMessage({ message: "new row violates row-level security policy", statusCode: "403" })).toBe(PHOTO_LIMIT_MESSAGE);
    expect(photoUploadErrorMessage({ message: "Unauthorized", statusCode: 403 })).toBe(PHOTO_LIMIT_MESSAGE);
    expect(photoUploadErrorMessage({ message: "Failed to fetch" })).toBe("Upload failed. Check your connection and try again.");
    expect(photoUploadErrorMessage(null)).toBe("Upload failed. Check your connection and try again.");
    // The message states the same numbers the storage rule enforces, and that nothing was removed.
    expect(PHOTO_LIMITS).toEqual({ total: 500, perDay: 30, totalBytes: 1024 ** 3 });
    expect(PHOTO_LIMIT_MESSAGE).toMatch(/500 photos, 30 a day, 1 GB/);
    expect(PHOTO_LIMIT_MESSAGE).toMatch(/all still here/);
  });
});
