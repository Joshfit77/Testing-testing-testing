import { formVideoSearchUrl, videoEmbedUrl } from "@/lib/media";

describe("video links", () => {
  it("converts YouTube links to privacy-enhanced embeds", () => {
    const e = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(e);
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe(e);
    expect(videoEmbedUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toBe(e);
    expect(videoEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(e);
  });
  it("converts Vimeo links", () => {
    expect(videoEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
  });
  it("rejects other or unsafe links", () => {
    expect(videoEmbedUrl("https://example.com/squat.mp4")).toBeNull();
    expect(videoEmbedUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=<script>")).toBeNull();
    expect(videoEmbedUrl("not a url")).toBeNull();
  });
  it("builds a search link", () => {
    expect(formVideoSearchUrl("Barbell Back Squat")).toBe("https://www.youtube.com/results?search_query=Barbell%20Back%20Squat%20proper%20form");
  });
});
