import { describe, expect, it } from "vitest";
import { platformFromUserAgent } from "@/lib/native-platform";

const TOKEN = " NarrowGateApp";

describe("platformFromUserAgent", () => {
  it("is null in a browser", () => {
    expect(platformFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148")).toBeNull();
  });
  it("finds the iPhone app", () => {
    expect(platformFromUserAgent(`Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148${TOKEN}`)).toBe("ios");
  });
  it("finds the iPad app even when the iPad WebView reports a desktop (Macintosh) user agent", () => {
    expect(platformFromUserAgent(`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)${TOKEN}`)).toBe("ios");
    expect(platformFromUserAgent(`Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148${TOKEN}`)).toBe("ios");
  });
  it("finds the Android app", () => {
    expect(platformFromUserAgent(`Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36${TOKEN}`)).toBe("android");
  });
});
