import { exerciseMediaPublicUrl, extensionForMime, mediaExtension, parseExerciseMediaPath } from "@/lib/exercise-media";

describe("exercise media paths", () => {
  it("accepts files directly inside the exercise's folder", () => {
    expect(parseExerciseMediaPath("back-squat", "back-squat/3f2b8c1e-4d5a-4e6f-8a9b-0c1d2e3f4a5b.mp4")).toEqual({ ext: "mp4", mediaType: "video" });
    expect(parseExerciseMediaPath("back-squat", "back-squat/back-squat.webp")).toEqual({ ext: "webp", mediaType: "image" });
  });
  it("rejects other folders, traversal, nesting and bad extensions", () => {
    expect(parseExerciseMediaPath("back-squat", "front-squat/a.mp4")).toBeNull();
    expect(parseExerciseMediaPath("back-squat", "back-squat/../front-squat/a.mp4")).toBeNull();
    expect(parseExerciseMediaPath("back-squat", "back-squat/nested/a.mp4")).toBeNull();
    expect(parseExerciseMediaPath("back-squat", "back-squat/a.gif")).toBeNull();
    expect(parseExerciseMediaPath("back-squat", "back-squat/a.MP4")).toBeNull();
    expect(parseExerciseMediaPath("Bad Slug", "Bad Slug/a.mp4")).toBeNull();
  });
  it("maps file names and MIME types to extensions", () => {
    expect(mediaExtension("Squat.MP4")).toBe("mp4");
    expect(mediaExtension("notes.txt")).toBeNull();
    expect(extensionForMime("video/mp4", "clip.mov")).toBe("mp4");
    expect(extensionForMime("image/jpeg", "photo.jpeg")).toBe("jpeg");
    expect(extensionForMime("image/jpeg", "photo")).toBe("jpg");
    expect(extensionForMime("video/quicktime", "clip.mov")).toBeNull();
  });
  it("builds public URLs", () => {
    expect(exerciseMediaPublicUrl("https://x.supabase.co/", "back-squat/a.mp4")).toBe("https://x.supabase.co/storage/v1/object/public/exercise-media/back-squat/a.mp4");
  });
});
