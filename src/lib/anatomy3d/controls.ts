/**
 * Touch and mouse controls for the 3D players: one finger (or the mouse) turns the figure all the way round; two
 * fingers pinch to zoom and drag up or down to move along the body; the wheel zooms too.
 *
 * Shared by the in-app demonstration (components/train/exercise-demo-3d.tsx) and the preview page
 * (scripts/anatomy/preview/app.ts). Returns a function that removes the listeners again.
 */
export function attachControls(
  canvas: HTMLCanvasElement,
  c: { orbit(dYaw: number, dPitch: number): void; zoom(f: number): void; pan?(dh: number): void },
): () => void {
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";
  const touches = new Map<number, { x: number; y: number }>();
  const pair = () => {
    const [a, b] = [...touches.values()];
    return a && b ? { spread: Math.hypot(a.x - b.x, a.y - b.y), midY: (a.y + b.y) / 2 } : null;
  };
  const ac = new AbortController();
  const { signal } = ac;
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // (A pointer that is gone already: nothing to capture.)
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      const prev = touches.get(e.pointerId);
      if (!prev) return;
      if (touches.size >= 2) {
        const before = pair();
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const after = pair();
        if (before && after && before.spread > 0 && after.spread > 0) c.zoom(before.spread / after.spread);
        if (before && after && c.pan) c.pan((after.midY - before.midY) / Math.max(1, canvas.clientHeight));
        return;
      }
      c.orbit((e.clientX - prev.x) * 0.008, (e.clientY - prev.y) * 0.004);
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    },
    { signal },
  );
  const lift = (e: PointerEvent) => touches.delete(e.pointerId);
  canvas.addEventListener("pointerup", lift, { signal });
  canvas.addEventListener("pointercancel", lift, { signal });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      c.zoom(Math.exp(e.deltaY * 0.0012));
    },
    { passive: false, signal },
  );
  return () => {
    ac.abort();
    touches.clear();
    canvas.style.touchAction = previousTouchAction;
  };
}
