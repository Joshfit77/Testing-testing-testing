import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExerciseDemo25D } from "@/components/train/exercise-demo-25d";
import type { ExerciseDemoAsset } from "@/lib/exercise-demos";

// A made-up exercise with two camera views; no real exercise has a second filmed view yet, so this is how the view bar
// is exercised. jsdom has no media playback: play and pause are stubbed and only their calls are checked.
const asset: ExerciseDemoAsset = {
  mode: "video",
  status: "review",
  poster: "/x/poster.webp",
  thumb: "/x/thumb.webp",
  mp4: "/x/loop.mp4",
  webm: "/x/loop.webm",
  durationMs: 3000,
  slow: { mp4: "/x/loop-half.mp4", webm: "/x/loop-half.webm", durationMs: 6000 },
  scrub: { base: "/x/scrub/", count: 45, width: 400, height: 300 },
  mainAngle: "Front",
  angles: [{ label: "Side", poster: "/x/side.webp", mp4: "/x/angle-side.mp4", webm: "/x/angle-side.webm", durationMs: 3000, slow: { mp4: "/x/angle-side-half.mp4" }, scrub: { base: "/x/scrub-side/", count: 45, width: 400, height: 300 } }],
  width: 1200,
  height: 900,
  loop: true,
  phases: [{ label: "Start", src: "/x/p1.webp", t: 0 }, { label: "Top", src: "/x/p2.webp", t: 1.5 }],
  highlighted: ["biceps"],
};

const sources = () => Array.from(document.querySelectorAll("video source")).map((s) => s.getAttribute("src"));
const root = () => screen.getByTestId("exercise-demo-25d");
const surface = () => screen.getByRole("group", { name: /Tap to play or pause/ });

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  // A source is "chosen", so the failure check stays quiet.
  vi.spyOn(HTMLMediaElement.prototype, "networkState", "get").mockReturnValue(1);
});
afterEach(() => vi.restoreAllMocks());

describe("the 2.5D player's touch controls", () => {
  it("plays the normal file, then the real 0.5x file, and back", () => {
    render(<ExerciseDemo25D slug="x" name="Test Curl" asset={asset} />);
    expect(sources()).toEqual(["/x/loop.mp4", "/x/loop.webm"]);
    fireEvent.click(screen.getByRole("button", { name: "0.5×" }));
    expect(root()).toHaveAttribute("data-speed", "0.5");
    expect(sources()).toEqual(["/x/loop-half.mp4", "/x/loop-half.webm"]);
    expect(screen.getByRole("button", { name: "0.5×" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Normal" }));
    expect(sources()).toEqual(["/x/loop.mp4", "/x/loop.webm"]);
  });

  it("toggles play and pause with a tap on the picture, not with a drag", () => {
    render(<ExerciseDemo25D slug="x" name="Test Curl" asset={asset} />);
    expect(root()).toHaveAttribute("data-playing", "true");
    fireEvent.pointerDown(surface(), { pointerId: 1, clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerUp(surface(), { pointerId: 1, clientX: 102, clientY: 101, pointerType: "touch" });
    expect(root()).toHaveAttribute("data-playing", "false");
    fireEvent.pointerDown(surface(), { pointerId: 2, clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerUp(surface(), { pointerId: 2, clientX: 100, clientY: 100, pointerType: "touch" });
    expect(root()).toHaveAttribute("data-playing", "true");
  });

  it("scrubs on a sideways drag (pausing it), and leaves an up-and-down drag to the page", () => {
    render(<ExerciseDemo25D slug="x" name="Test Curl" asset={asset} />);
    fireEvent.pointerDown(surface(), { pointerId: 3, clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerMove(surface(), { pointerId: 3, clientX: 100, clientY: 140, pointerType: "touch" });
    fireEvent.pointerUp(surface(), { pointerId: 3, clientX: 100, clientY: 180, pointerType: "touch" });
    expect(root()).toHaveAttribute("data-scrubbing", "false");
    expect(root()).toHaveAttribute("data-playing", "true");
    fireEvent.pointerDown(surface(), { pointerId: 4, clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerMove(surface(), { pointerId: 4, clientX: 140, clientY: 104, pointerType: "touch" });
    expect(root()).toHaveAttribute("data-scrubbing", "true");
    expect(root()).toHaveAttribute("data-playing", "false");
    fireEvent.pointerUp(surface(), { pointerId: 4, clientX: 160, clientY: 104, pointerType: "touch" });
    expect(root()).toHaveAttribute("data-scrubbing", "false");
    expect(root()).toHaveAttribute("data-playing", "false");
  });

  it("swipes between camera views on the view bar and keeps the speed", () => {
    render(<ExerciseDemo25D slug="x" name="Test Curl" asset={asset} />);
    expect(screen.getByText(/2 camera views: swipe the view bar to change/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "0.5×" }));
    const bar = screen.getByTestId("demo-view-bar");
    fireEvent.pointerDown(bar, { clientX: 220, clientY: 10 });
    fireEvent.pointerUp(bar, { clientX: 120, clientY: 14 });
    expect(root()).toHaveAttribute("data-view", "1");
    expect(sources()).toEqual(["/x/angle-side-half.mp4"]);
    expect(screen.getByRole("button", { name: "Side" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next camera view" }));
    expect(root()).toHaveAttribute("data-view", "0");
  });

  it("replays, enlarges into a full-screen view, and says a one-view clip does not rotate", async () => {
    const one = { ...asset, angles: undefined };
    render(<ExerciseDemo25D slug="x" name="Test Curl" asset={one} />);
    expect(screen.queryByTestId("demo-view-bar")).toBeNull();
    expect(screen.getByText(/One fixed camera view \(it does not rotate\)/)).toBeInTheDocument();
    fireEvent.pointerDown(surface(), { pointerId: 5, clientX: 10, clientY: 10, pointerType: "touch" });
    fireEvent.pointerUp(surface(), { pointerId: 5, clientX: 10, clientY: 10, pointerType: "touch" });
    expect(root()).toHaveAttribute("data-playing", "false");
    fireEvent.click(screen.getByRole("button", { name: "Replay from the start" }));
    expect(root()).toHaveAttribute("data-playing", "true");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enlarge" }));
    });
    const dialog = await screen.findByRole("dialog");
    const players = screen.getAllByTestId("exercise-demo-25d");
    expect(players).toHaveLength(2);
    expect(dialog.querySelector('[data-expanded="true"]')).not.toBeNull();
    // The inline player pauses while the enlarged one shows; the enlarged one carries on playing.
    expect(players[0]).toHaveAttribute("data-playing", "false");
    expect(dialog.querySelector('[data-testid="exercise-demo-25d"]')).toHaveAttribute("data-playing", "true");
  });
});
