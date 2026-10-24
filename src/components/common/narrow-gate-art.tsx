import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import geo from "./gate-geometry.json";

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

/** A few motes of dust drifting in the light (left %, top %, size in % of the scene's height, delay s). */
const DUST: [number, number, number, number][] = [
  [47.2, 48, 0.22, 0],
  [52.6, 55, 0.18, 0.6],
  [49.4, 62, 0.26, 1.1],
  [54.1, 44, 0.16, 0.3],
  [45.8, 58, 0.2, 1.6],
  [51.3, 39, 0.17, 0.9],
  [48.6, 70, 0.24, 0.4],
  [53.4, 66, 0.19, 1.3],
];

/**
 * The narrow gate: a rendered scene (scripts/opening/render_gate.py) of a dark stone wall with a moulded bronze-and-gold
 * doorway, a polished threshold and floor, and soft white light beyond. The shut scene (with light leaking round
 * the door) is the base picture; the light the open door lets out is a second picture added on top as the door
 * opens; the door leaf is turned about its hinge in real 3D, with the renderer's camera (gate-geometry.json), so it
 * lines up with the doorway. Mist drifts through the light and a few motes of dust catch it.
 * `still` shows it open and at rest (welcome page); otherwise globals.css plays the opening sequence.
 */
export function NarrowGateArt({ still = false, className }: { still?: boolean; className?: string }) {
  const d = geo.door;
  const [ox = 0.5, oy = 0.5] = geo.origin;
  const [gx = 0.5, gy = 0.44] = geo.doorway;
  const style = {
    "--door-l": pct(d.left),
    "--door-t": pct(d.top),
    "--door-w": pct(d.right - d.left),
    "--door-h": pct(d.bottom - d.top),
    "--door-r": pct(d.archRadius),
    "--persp": `${(geo.perspective * 100).toFixed(3)}cqh`,
    "--po": `${pct(ox)} ${pct(oy)}`,
    "--gate-x": pct(gx),
    "--gate-y": gy.toFixed(4),
  } as CSSProperties;
  return (
    <div className={cn("ngs", still && "ngs--still", className)} style={style} data-testid="animated-narrow-door" aria-hidden="true">
      <div className="ngs-push">
        <div className="ngs-drift">
          <div className="ngs-box">
            <div className="ngs-scene">
              {/* CSS backgrounds, so the pictures load only where the gate is shown (the head script preloads them). */}
              <div className="ngs-base" />
              <div className="ngs-light" />
              <div className="ngs-door" data-testid="gate-door" />
            </div>
            <div className="ngs-haze" />
            {!still && (
              <div className="ngs-dust">
                {DUST.map(([x, y, s, delay]) => (
                  <i key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, width: `${s}cqh`, height: `${s}cqh`, animationDelay: `${2.2 + delay}s, ${2.2 + delay}s` }} />
                ))}
              </div>
            )}
            <div className="ngs-edge" />
          </div>
        </div>
      </div>
    </div>
  );
}
