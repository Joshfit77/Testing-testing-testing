import { afterEach, describe, expect, it, vi } from "vitest";
import { fitCamera, mountExerciseMotion } from "@/lib/exercise-motion";

// jsdom has no 2D canvas: the player still builds its controls and simply draws nothing.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(opts: Parameters<typeof mountExerciseMotion>[2] = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const ctrl = mountExerciseMotion(host, "back-squat", { autoplay: false, ...opts });
  return { host, ctrl };
}

describe("the 2D demonstration player", () => {
  it("puts the controls in their own strip under the picture, not over the athlete", () => {
    const { host } = mount();
    const stage = host.querySelector("[data-motion-stage]")!;
    const controls = host.querySelector("[data-motion-controls]")!;
    expect(stage.querySelector("canvas[data-motion-canvas]")).not.toBeNull();
    expect(stage.querySelector("button, input")).toBeNull();
    expect(stage.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(controls.querySelector('[aria-label="Play demonstration"]')).not.toBeNull();
    expect(controls.querySelector('[aria-label="Full screen"]')).not.toBeNull();
  });

  it("gives the position bar a 44px touch target, and it still moves through the rep", () => {
    const { host, ctrl } = mount();
    const bar = host.querySelector<HTMLInputElement>('input[aria-label="Position in the movement"]')!;
    expect(bar.style.height).toBe("44px");
    bar.value = "500";
    bar.dispatchEvent(new Event("input"));
    expect(ctrl.phase).toBeCloseTo(0.5, 2);
  });

  it("keeps play, speed and full screen working", () => {
    const { host, ctrl } = mount();
    host.querySelector<HTMLButtonElement>('[aria-label="Play demonstration"]')!.click();
    // Reduced motion (jsdom has no matchMedia) is off here, so playing starts.
    expect(ctrl.playing).toBe(true);
    host.querySelector<HTMLButtonElement>('[aria-label^="1× Playback speed normal"]')!.click();
    expect(ctrl.speed).toBe(0.5);
    host.querySelector<HTMLButtonElement>('[aria-label="Full screen"]')!.click();
    expect(ctrl.fullscreen).toBe(true);
    ctrl.destroy();
  });

  it("does not autoplay with reduced motion", () => {
    const { ctrl } = mount({ autoplay: true, reducedMotion: true });
    expect(ctrl.playing).toBe(false);
  });

  it("without controls, the picture is all there is", () => {
    const { host } = mount({ controls: false });
    expect(host.querySelector("[data-motion-controls]")).toBeNull();
    expect(host.querySelector("canvas[data-motion-canvas]")).not.toBeNull();
  });

  it("frames the figure tightly: it fills most of the picture's height", () => {
    const cam = fitCamera({ x0: -50, x1: 50, y0: 0, y1: 200 }, 360, 220, 1);
    // 200 world units tall at this scale, out of a 220px-tall picture.
    expect((200 * cam.scale) / 220).toBeGreaterThan(0.85);
  });
});
