/**
 * Synthetic pose-keypoint sequences for the form-analysis unit tests.
 *
 * These are idealised stick figures driven by a joint-angle timeline. They exercise the code paths
 * (segmentation, depth, tempo, quality checks) but say NOTHING about accuracy on real camera
 * footage, real pose-model output, or real people.
 *
 * Coordinates: pixels, origin top-left, y down. The member faces +x and the camera sees the right side.
 */
import type { Joint, Keypoint, KeypointName, PoseFrame, Side } from "@/lib/form-analysis";

export interface RepSpec {
  /** Peak joint flexion in degrees (knee for squats, elbow for push-ups). */
  depthDeg: number;
  downSeconds?: number;
  upSeconds?: number;
  bottomPauseSeconds?: number;
}

export interface FixtureOptions {
  fps?: number;
  /** Either a number of identical reps (using the defaults below) or explicit per-rep specs. */
  reps?: number | RepSpec[];
  depthDeg?: number;
  downSeconds?: number;
  upSeconds?: number;
  topPauseSeconds?: number;
  leadInSeconds?: number;
  leadOutSeconds?: number;
  /** Seconds trimmed from the start of the timeline (to start the recording mid-rep). */
  trimStartSeconds?: number;
  /** Seconds trimmed from the end of the timeline (to end the recording mid-rep). */
  trimEndSeconds?: number;
  /** Gaussian noise standard deviation in pixels, applied to every keypoint coordinate. */
  noisePx?: number;
  seed?: number;
  view?: "side" | "front";
  /** Confidence of the far (mostly occluded) side in side view. */
  farSideConfidence?: number;
  /** Frames for which this returns true are removed entirely (dropped frames). */
  drop?: (index: number, timeMs: number) => boolean;
  /** Frames for which this returns true keep their coordinates but get confidence 0.2. */
  lowConfidence?: (index: number, timeMs: number) => boolean;
  startMs?: number;
}

type Pose = Record<Joint, { x: number; y: number }>;

const SCALE = 400; // pixels per body unit
const TOP_FLEXION = { squat: 4, pushUp: 10 };

/** Deterministic PRNG (mulberry32) and Box-Muller normal samples. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const ease = (p: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, p)))) / 2;

/** Joint flexion over time for a set: piecewise cosine-eased descent/ascent with pauses. */
export function flexionTimeline(opts: FixtureOptions, topFlexion: number): { at: (t: number) => number; durationS: number } {
  const specs: RepSpec[] =
    typeof opts.reps === "object"
      ? opts.reps
      : Array.from({ length: opts.reps ?? 5 }, () => ({ depthDeg: opts.depthDeg ?? 110 }));
  const segments: { from: number; to: number; dur: number }[] = [];
  segments.push({ from: topFlexion, to: topFlexion, dur: opts.leadInSeconds ?? 0.6 });
  specs.forEach((spec, i) => {
    const down = spec.downSeconds ?? opts.downSeconds ?? 1.5;
    const up = spec.upSeconds ?? opts.upSeconds ?? 1.0;
    segments.push({ from: topFlexion, to: spec.depthDeg, dur: down });
    if (spec.bottomPauseSeconds) segments.push({ from: spec.depthDeg, to: spec.depthDeg, dur: spec.bottomPauseSeconds });
    segments.push({ from: spec.depthDeg, to: topFlexion, dur: up });
    const pause = i === specs.length - 1 ? (opts.leadOutSeconds ?? 0.6) : (opts.topPauseSeconds ?? 0.5);
    segments.push({ from: topFlexion, to: topFlexion, dur: pause });
  });
  const durationS = segments.reduce((s, seg) => s + seg.dur, 0);
  return {
    durationS,
    at(t: number) {
      let acc = 0;
      for (const seg of segments) {
        if (t <= acc + seg.dur) return seg.from + (seg.to - seg.from) * ease((t - acc) / seg.dur);
        acc += seg.dur;
      }
      return topFlexion;
    },
  };
}

const deg = (d: number) => (d * Math.PI) / 180;

/** Side-view squat stick figure for a given knee flexion (0 = straight leg). */
export function squatPose(kneeFlexionDeg: number): Pose {
  const shin = 0.45;
  const thigh = 0.45;
  const torso = 0.55;
  const ankle = { x: 640, y: 650 };
  const shinLean = deg(0.35 * kneeFlexionDeg); // knee travels forward as the knee bends
  const knee = { x: ankle.x + SCALE * shin * Math.sin(shinLean), y: ankle.y - SCALE * shin * Math.cos(shinLean) };
  const thighDir = shinLean - deg(kneeFlexionDeg); // rotate backwards by the flexion angle
  const hip = { x: knee.x + SCALE * thigh * Math.sin(thighDir), y: knee.y - SCALE * thigh * Math.cos(thighDir) };
  const torsoLean = deg(0.3 * kneeFlexionDeg);
  const shoulder = { x: hip.x + SCALE * torso * Math.sin(torsoLean), y: hip.y - SCALE * torso * Math.cos(torsoLean) };
  // Goblet-style arms: elbows below and in front of the shoulder, hands at the chest.
  const elbow = { x: shoulder.x + SCALE * 0.12, y: shoulder.y + SCALE * 0.22 };
  const wrist = { x: shoulder.x + SCALE * 0.15, y: shoulder.y + SCALE * 0.05 };
  return { shoulder, elbow, wrist, hip, knee, ankle };
}

/** Side-view push-up stick figure for a given elbow flexion (0 = straight arm). */
export function pushUpPose(elbowFlexionDeg: number): Pose {
  const upper = 0.3;
  const fore = 0.28;
  const floorY = 650;
  const wrist = { x: 900, y: floorY };
  const elbowAngle = deg(180 - elbowFlexionDeg);
  const d = Math.sqrt(upper ** 2 + fore ** 2 - 2 * upper * fore * Math.cos(elbowAngle));
  const shoulder = { x: wrist.x, y: floorY - SCALE * d };
  const gamma = Math.acos((fore ** 2 + d ** 2 - upper ** 2) / (2 * fore * d)); // forearm angle from vertical
  const elbow = { x: wrist.x - SCALE * fore * Math.sin(gamma), y: floorY - SCALE * fore * Math.cos(gamma) };
  const ankle = { x: wrist.x - SCALE * 1.4, y: floorY - SCALE * 0.05 };
  const along = (f: number) => ({ x: ankle.x + (shoulder.x - ankle.x) * f, y: ankle.y + (shoulder.y - ankle.y) * f });
  return { shoulder, elbow, wrist, hip: along(0.6), knee: along(0.3), ankle };
}

const FRONT_HALF_WIDTH: Record<Joint, number> = {
  shoulder: 0.2,
  elbow: 0.22,
  wrist: 0.2,
  hip: 0.15,
  knee: 0.12,
  ankle: 0.12,
};

function name(side: Side, joint: Joint): KeypointName {
  return `${side}${joint[0]!.toUpperCase()}${joint.slice(1)}` as KeypointName;
}

function generate(poseAt: (flex: number) => Pose, topFlexion: number, opts: FixtureOptions): PoseFrame[] {
  const fps = opts.fps ?? 30;
  const timeline = flexionTimeline(opts, topFlexion);
  const rand = seededRandom(opts.seed ?? 1);
  const noise = opts.noisePx ?? 0;
  const trimStart = opts.trimStartSeconds ?? 0;
  const endS = timeline.durationS - (opts.trimEndSeconds ?? 0);
  const startMs = opts.startMs ?? 1_000;
  const frames: PoseFrame[] = [];
  const joints = Object.keys(FRONT_HALF_WIDTH) as Joint[];

  for (let i = 0; trimStart + i / fps <= endS; i++) {
    const t = trimStart + i / fps;
    const timeMs = startMs + Math.round((i * 1000) / fps);
    const pose = poseAt(timeline.at(t));
    const low = opts.lowConfidence?.(i, timeMs) ?? false;
    const keypoints: Partial<Record<KeypointName, Keypoint>> = {};
    for (const joint of joints) {
      const p = pose[joint];
      const jitter = () => (noise ? gaussian(rand) * noise : 0);
      if (opts.view === "front") {
        const hw = FRONT_HALF_WIDTH[joint] * SCALE;
        keypoints[name("right", joint)] = { x: p.x - hw + jitter(), y: p.y + jitter(), confidence: low ? 0.2 : 0.9 };
        keypoints[name("left", joint)] = { x: p.x + hw + jitter(), y: p.y + jitter(), confidence: low ? 0.2 : 0.9 };
      } else {
        keypoints[name("right", joint)] = { x: p.x + jitter(), y: p.y + jitter(), confidence: low ? 0.2 : 0.9 };
        keypoints[name("left", joint)] = {
          x: p.x + 6 + jitter(),
          y: p.y - 4 + jitter(),
          confidence: low ? 0.2 : (opts.farSideConfidence ?? 0.3),
        };
      }
    }
    if (opts.drop?.(i, timeMs)) continue;
    frames.push({ timestampMs: timeMs, keypoints });
  }
  return frames;
}

export function squatFrames(opts: FixtureOptions = {}): PoseFrame[] {
  return generate(squatPose, TOP_FLEXION.squat, opts);
}

export function pushUpFrames(opts: FixtureOptions = {}): PoseFrame[] {
  return generate(pushUpPose, TOP_FLEXION.pushUp, { depthDeg: 100, ...opts });
}
