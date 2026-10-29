// The 3D exercise showcase (DEMO 1): five exercises on the Écorché figure in its own red and white (gold as a switch),
// switched in place without reloading, with the player's controls, the exercise's instructions and muscles, and the
// honest status of each motion (automated checks, visual review, owner approval) from the status the build embeds.
import { mountModel, type ModelFace, type ModelViewer } from "../../../src/lib/anatomy3d/model-viewer";
import type { CameraView } from "../../../src/lib/anatomy3d/player";
import { attachControls } from "../../../src/lib/anatomy3d/controls";
import type { RigFiles } from "../../../src/lib/anatomy3d/body/bind-model";
import { EXERCISES } from "../../../src/data/exercises";
import { muscleTargets } from "../../../src/lib/anatomy3d/muscle-map";
import { REGION_LABELS, type Region } from "../../../src/lib/anatomy3d/muscle-ids";
import { ECORCHE_SHA256, fetchBinary, fetchModel } from "./files";

type Status = {
  result?: string;
  qa?: { verdict: string; findings?: string[] } | null;
  eye?: { verdict: string; note?: string } | null;
  owner?: { date: string; note: string } | null;
  inApp?: string;
};
declare global {
  interface Window {
    ready?: boolean;
    viewer?: unknown;
    showcaseSlug?: string;
    /** Set by a page that embeds the showcase: the figure starts only when showcaseShow is called. */
    SHOWCASE_LAZY?: boolean;
    showcaseShow?: (slug: string) => Promise<void>;
    showcasePause?: () => void;
    /** Set by the build: the exercises shown, in order. */
    SHOWCASE?: string[];
    /** Set by the build from library-status.mts --json: status per exercise. */
    STATUS?: Record<string, Status>;
  }
}

const SLUGS = window.SHOWCASE ?? ["kettlebell-swing", "dumbbell-curl", "inverted-row", "cable-chest-fly", "sled-push"];
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const fmt = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

// The files, fetched once and kept: the model, the face, the rig, the corrective shapes; each exercise's bake on demand.
const files = (() => {
  let glb: Promise<ArrayBuffer> | undefined, face: Promise<ModelFace> | undefined, rig: Promise<RigFiles> | undefined;
  const bakes = new Map<string, Promise<ArrayBuffer | undefined>>();
  return {
    glb: (onProgress: (f: number) => void) => (glb ??= fetchModel(onProgress)),
    face: () => (face ??= Promise.all([fetch("anatomy/ecorche-face.json").then((r) => r.json()), fetchBinary("anatomy/ecorche-face.bin", window.FACE_PARTS, () => {})]).then(([meta, data]) => ({ meta, data }))),
    rig: () =>
      (rig ??= (async () => {
        const r: RigFiles = { meta: await (await fetch("anatomy/ecorche-rig.json")).json(), data: await fetchBinary("anatomy/ecorche-rig.bin", window.RIG_PARTS, () => {}) };
        r.correctives = await Promise.all([fetch("anatomy/ecorche-correctives.json").then((x) => (x.ok ? x.json() : Promise.reject(new Error(String(x.status))))), fetchBinary("anatomy/ecorche-correctives.bin", window.CORR_PARTS, () => {})])
          .then(([meta, data]) => ({ meta, data }))
          .catch(() => undefined);
        return r;
      })()),
    bake: (slug: string) => {
      if (!bakes.has(slug)) bakes.set(slug, window.BAKE_PARTS && !window.BAKE_PARTS[slug] ? Promise.resolve(undefined) : fetchBinary(`anatomy/bake/${slug}.ngb`, window.BAKE_PARTS?.[slug], () => {}).catch(() => undefined));
      return bakes.get(slug)!;
    },
  };
})();

let viewer: ModelViewer | null = null;
let look: "original" | "gold" = "original";
let glowOn = true;
let speed = 1;
let view: CameraView = "front";
let current = SLUGS[0]!;
let detach: (() => void) | null = null;
let mounting = 0;

const webglAvailable = () => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
};

function statusBadge(slug: string) {
  const st = window.STATUS?.[slug];
  const badge = $<HTMLElement>("#status");
  const detail = $<HTMLElement>("#status-detail");
  if (!st) {
    badge.textContent = "NOT TESTED";
    badge.className = "badge untested";
    detail.textContent = "No status recorded for this motion.";
    return;
  }
  const approved = !!st.owner;
  const result = st.result ?? "NOT TESTED";
  badge.textContent = approved ? "OWNER APPROVED" : result === "PASS" ? "PASS · NOT YET OWNER-APPROVED" : result === "POLISH NEEDED" ? "POLISH NEEDED · NOT YET OWNER-APPROVED" : result;
  badge.className = `badge ${approved ? "approved" : result === "PASS" ? "pass" : result === "POLISH NEEDED" ? "polish" : result === "FAIL" ? "fail" : "untested"}`;
  const parts: string[] = [];
  parts.push(`Automated checks: ${st.qa ? (st.qa.verdict === "PASS" ? "pass" : `FAIL (${(st.qa.findings ?? []).join("; ")})`) : "not run"}.`);
  parts.push(`Visual review (the coding session's eye, not the owner's): ${st.eye ? `${st.eye.verdict}${st.eye.note ? ` — ${st.eye.note}` : ""}` : "not checked"}.`);
  parts.push(`Owner's approval: ${st.owner ? `${st.owner.date}: ${st.owner.note}` : "none yet"}.`);
  detail.textContent = parts.join(" ");
}

function fillText(slug: string) {
  const ex = EXERCISES.find((e) => e.slug === slug)!;
  document.title = `${ex.name} · 3D showcase`;
  $<HTMLElement>("#name").textContent = ex.name;
  $<HTMLElement>("#desc").textContent = ex.description ?? "";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  $<HTMLElement>("#chips").replaceChildren(
    ...([ex.category, ex.pattern, ex.mechanics, ex.difficulty, ...(ex.equipment ?? [])] as (string | undefined)[]).filter((x): x is string => !!x).map((x) => {
      const s = document.createElement("span");
      s.textContent = cap(String(x));
      return s;
    }),
  );
  const steps = $<HTMLOListElement>("#steps");
  steps.replaceChildren(
    ...(ex.instructions ?? []).map((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      return li;
    }),
  );
  const targets = muscleTargets(ex);
  const list = (regions: Region[], el: HTMLElement) =>
    el.replaceChildren(
      ...regions.map((r) => {
        const li = document.createElement("li");
        li.textContent = REGION_LABELS[r] ?? r;
        return li;
      }),
    );
  list(targets.primary, $("#primary"));
  list(targets.secondary, $("#secondary"));
  statusBadge(slug);
  document.querySelectorAll<HTMLButtonElement>("[data-ex]").forEach((b) => {
    b.classList.toggle("on", b.dataset.ex === slug);
    b.setAttribute("aria-pressed", String(b.dataset.ex === slug));
  });
}

/** Shows `slug` on a fresh canvas (a WebGL context is not reused once its renderer is gone), keeping the files. */
async function show(slug: string) {
  const token = ++mounting;
  current = slug;
  window.showcaseSlug = slug;
  fillText(slug);
  const stage = $<HTMLElement>(".stage");
  const loading = $<HTMLElement>("#loading");
  loading.hidden = false;
  loading.textContent = "Loading…";
  if (viewer) {
    detach?.();
    viewer.dispose();
    viewer = null;
  }
  const old = $<HTMLCanvasElement>("#stage");
  const canvas = document.createElement("canvas");
  canvas.id = "stage";
  canvas.setAttribute("role", "img");
  old.replaceWith(canvas);
  const ex = EXERCISES.find((e) => e.slug === slug)!;
  canvas.setAttribute("aria-label", `3D anatomical figure performing the ${ex.name}. One finger turns it, pinch to zoom.`);
  if (!webglAvailable()) {
    loading.textContent = "3D isn't available on this device (no WebGL). In the app the animated illustration is shown instead.";
    return;
  }
  try {
    const glb = await files.glb((f) => (loading.textContent = `Loading the model… ${Math.round(f * 100)}%`));
    if (token !== mounting) return;
    loading.textContent = "Loading the movement…";
    const [face, rig0, baked] = await Promise.all([files.face(), files.rig(), files.bake(slug)]);
    if (token !== mounting) return;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", glb)), (b) => b.toString(16).padStart(2, "0")).join("");
    $<HTMLElement>("#verify").textContent = hash === ECORCHE_SHA256 ? `Model file check: identical to the published Écorché file (SHA-256 ${hash.slice(0, 12)}…).` : `Model file check FAILED (SHA-256 ${hash.slice(0, 12)}…).`;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const v = await mountModel(canvas, { glb, face, look, rig: { ...rig0, baked }, pixelRatio: Math.min(devicePixelRatio || 1, 2), exercise: { ex, hideProps: ["rack"], reducedMotion } });
    if (token !== mounting) {
      v.dispose();
      return;
    }
    viewer = v;
  } catch (e) {
    loading.textContent = `The 3D figure could not be loaded (${(e as Error).message}). In the app the animated illustration is shown instead.`;
    console.error(e);
    return;
  }
  window.viewer = viewer;
  const fit = () => viewer?.resize(stage.clientWidth, stage.clientHeight);
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  const off = attachControls(canvas, viewer);
  detach = () => {
    off();
    ro.disconnect();
  };
  viewer.setGlow(glowOn);
  viewer.setView(view);
  const motion = viewer.motion!;
  motion.setSpeed(speed);
  const T = motion.duration;
  const scrub = $<HTMLInputElement>("#scrub");
  scrub.max = String(T);
  const time = $<HTMLElement>("#time");
  motion.onTick((t) => {
    scrub.value = String(t);
    time.textContent = `${fmt(t)} / ${fmt(T)}`;
  });
  setPlaying(true);
  loading.hidden = true;
  window.ready = true;
}

function setPlaying(on: boolean) {
  const m = viewer?.motion;
  if (!m) return;
  if (on) m.play();
  else m.pause();
  const b = $<HTMLButtonElement>("#play");
  b.classList.toggle("paused", !on);
  b.setAttribute("aria-label", on ? "Pause" : "Play");
  b.textContent = on ? "❚❚" : "▶";
}

// Controls, wired once; they act on whichever figure is on the stage.
{
  const tabs = $<HTMLElement>("#tabs");
  for (const slug of SLUGS) {
    const ex = EXERCISES.find((e) => e.slug === slug);
    if (!ex) continue;
    const b = document.createElement("button");
    b.dataset.ex = slug;
    b.textContent = ex.name;
    b.addEventListener("click", () => {
      if (slug !== current) void show(slug);
    });
    tabs.append(b);
  }
  $<HTMLButtonElement>("#play").addEventListener("click", () => setPlaying(!viewer?.motion?.playing));
  $<HTMLInputElement>("#scrub").addEventListener("input", (e) => {
    setPlaying(false);
    viewer?.motion?.seek(Number((e.target as HTMLInputElement).value));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach((b) =>
    b.addEventListener("click", () => {
      speed = Number(b.dataset.speed);
      viewer?.motion?.setSpeed(speed);
      document.querySelectorAll("[data-speed]").forEach((x) => x.classList.toggle("on", x === b));
      setPlaying(true);
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.view as CameraView;
      viewer?.setView(view);
      document.querySelectorAll("[data-view]").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
    }),
  );
  const glow = $<HTMLInputElement>("#glow");
  glow.addEventListener("change", () => {
    glowOn = glow.checked;
    viewer?.setGlow(glowOn);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-look]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = b.dataset.look as "original" | "gold";
      if (next === look) return;
      look = next;
      document.querySelectorAll("[data-look]").forEach((x) => x.classList.toggle("on", x === b));
      void show(current);
    }),
  );
  const start = location.hash.length > 1 && SLUGS.includes(decodeURIComponent(location.hash.slice(1))) ? decodeURIComponent(location.hash.slice(1)) : SLUGS[0]!;
  // A page that embeds the showcase (the iPhone demo) starts it itself, when the figure is first opened.
  window.showcaseShow = (slug) => show(SLUGS.includes(slug) ? slug : SLUGS[0]!);
  window.showcasePause = () => setPlaying(false);
  if (!window.SHOWCASE_LAZY) void show(start);
}
