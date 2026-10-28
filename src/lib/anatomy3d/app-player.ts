/**
 * The 3D anatomical demonstration inside the app: fetches the Écorché model, its face, the anatomical rig and the
 * exercise's baked motion from /anatomy (public/anatomy), and mounts the model viewer on a canvas.
 *
 * Loaded on demand by components/train/exercise-demo-3d.tsx, so a screen without a 3D demonstration never downloads
 * three.js or the model. The files are kept once fetched: opening the player again, for this or another exercise,
 * downloads only that exercise's motion.
 */
import { EXERCISES } from "@/data/exercises";
import type { CorrectiveMeta } from "./body/correctives";
import type { RigMeta } from "./body/skeleton";
import { mountModel, type ModelFace, type ModelViewer } from "./model-viewer";

/** Where the model's files are served from. */
const BASE = "/anatomy";

/** The files' sizes in MB, to weight the overall download progress (a compressed response may carry no content-length). */
const SIZE_MB = { glb: 14.3, rig: 4.4, face: 2.7, correctives: 0.9, bake: 0.12 } as const;
type Part = keyof typeof SIZE_MB;

const binaries = new Map<string, Promise<ArrayBuffer>>();
const jsons = new Map<string, Promise<unknown>>();

/** A binary file, streamed with progress (0..1). */
async function fetchBinary(url: string, expectedBytes: number, onProgress: (f: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  if (!res.body) return res.arrayBuffer();
  const total = Number(res.headers.get("content-length")) || expectedBytes;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(0.99, got / total));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  onProgress(1);
  return out.buffer;
}

/** The file's bytes, fetched once per page; a failed fetch is forgotten so the next try fetches again. */
function binary(url: string, expectedBytes: number, onProgress: (f: number) => void): Promise<ArrayBuffer> {
  let p = binaries.get(url);
  if (!p) {
    p = fetchBinary(url, expectedBytes, onProgress).catch((e) => {
      binaries.delete(url);
      throw e;
    });
    binaries.set(url, p);
  } else {
    void p.then(() => onProgress(1), () => {});
  }
  return p;
}

function json<T>(url: string): Promise<T> {
  let p = jsons.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.json();
      })
      .catch((e) => {
        jsons.delete(url);
        throw e;
      });
    jsons.set(url, p);
  }
  return p as Promise<T>;
}

export interface AppModelOptions {
  /** Download progress, 0..1 over all the files. */
  onProgress?: (fraction: number) => void;
  /** The athlete prefers reduced motion: the figure holds its still pose (the player's controls still step through it). */
  reducedMotion?: boolean;
  pixelRatio?: number;
}

/** The exercise's 3D demonstration on the canvas: the model, on the anatomical rig, performing its baked motion. */
export async function mountAppModel(canvas: HTMLCanvasElement, slug: string, o: AppModelOptions = {}): Promise<ModelViewer> {
  const ex = EXERCISES.find((e) => e.slug === slug);
  if (!ex) throw new Error(`no exercise "${slug}"`);
  const done: Record<Part, number> = { glb: 0, rig: 0, face: 0, correctives: 0, bake: 0 };
  const total = Object.values(SIZE_MB).reduce((a, b) => a + b, 0);
  const report = (part: Part) => (f: number) => {
    done[part] = f;
    o.onProgress?.((Object.keys(SIZE_MB) as Part[]).reduce((sum, k) => sum + done[k] * SIZE_MB[k], 0) / total);
  };
  const mb = (part: Part) => Math.round(SIZE_MB[part] * 1e6);
  const [glb, rigMeta, rigData, faceMeta, faceData, correctives, baked] = await Promise.all([
    binary(`${BASE}/ecorche.glb`, mb("glb"), report("glb")),
    json<RigMeta>(`${BASE}/ecorche-rig.json`),
    binary(`${BASE}/ecorche-rig.bin`, mb("rig"), report("rig")),
    json<ModelFace["meta"]>(`${BASE}/ecorche-face.json`),
    binary(`${BASE}/ecorche-face.bin`, mb("face"), report("face")),
    // The shoulder and hip corrective shapes, when built; without them the skinning alone.
    Promise.all([json<CorrectiveMeta>(`${BASE}/ecorche-correctives.json`), binary(`${BASE}/ecorche-correctives.bin`, mb("correctives"), report("correctives"))])
      .then(([meta, data]) => ({ meta, data }))
      .catch(() => {
        report("correctives")(1);
        return undefined;
      }),
    // (An exercise without a baked motion is solved live, as in the preview page.)
    binary(`${BASE}/bake/${slug}.ngb`, mb("bake"), report("bake")).catch(() => undefined),
  ]);
  return mountModel(canvas, {
    glb,
    face: { meta: faceMeta, data: faceData },
    look: "gold",
    rig: { meta: rigMeta, data: rigData, baked, correctives },
    pixelRatio: o.pixelRatio ?? Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 2),
    exercise: { ex, hideProps: ["rack"], reducedMotion: o.reducedMotion },
  });
}
