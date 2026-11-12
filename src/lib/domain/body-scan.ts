/** Body Scan (Pro): shared constants, guidance and pure helpers (safe for client and server). */
import type { Plan } from "./types";

export const BODY_SCAN_BUCKET = "body-scans";
export const SCAN_POSES = ["front", "side", "back"] as const;
export type ScanPose = (typeof SCAN_POSES)[number];
export const REQUIRED_POSES: ScanPose[] = ["front", "side"];
export const SCAN_POSE_LABELS: Record<ScanPose, string> = { front: "Front", side: "Side", back: "Rear" };
export const SCAN_NOTE_MAX = 280;
/** Longest edge after downscaling on the device; enough to compare shape, small enough to upload on mobile data. */
export const SCAN_MAX_DIMENSION = 1600;
export const SCAN_TIMER_SECONDS = 10;

/** Body Scan is a Pro feature (the database checks the same with has_plan('pro')). */
export function canUseBodyScan(plan: Plan): boolean {
  return plan === "pro";
}

/** Shown before every scan: the same set-up each time is what makes scans comparable. */
export const SCAN_GUIDANCE: { title: string; points: string[] }[] = [
  {
    title: "Lighting",
    points: ["Face a window or a light so the light falls evenly on the front of your body.", "Avoid a bright window or lamp behind you and strong light straight overhead.", "Use the same room and lighting every time."],
  },
  {
    title: "Distance and framing",
    points: [
      "Prop the phone upright at about waist height, 2–3 m (6–10 ft) away.",
      "Your whole body, head to feet, should fit inside the outline.",
      "Use the 10-second timer, or ask someone to take the photo.",
    ],
  },
  {
    title: "Pose",
    points: [
      "Front and rear: stand tall, feet hip-width apart, arms a little away from your sides.",
      "Side: turn to your right, arms relaxed by your sides.",
      "Breathe normally. Don't flex or suck in.",
    ],
  },
  {
    title: "Consistency",
    points: ["Same time of day (morning, before eating, is easiest), same clothes, same spot.", "Fitted clothing shows changes best. Wear what you're comfortable storing.", "Your last scan appears faintly over the camera so you can match the pose."],
  },
];

export const SCAN_POSE_TIPS: Record<ScanPose, string> = {
  front: "Face the camera, feet hip-width apart, arms a little away from your sides.",
  side: "Turn to your right side. Arms relaxed by your sides, looking straight ahead.",
  back: "Turn your back to the camera, feet hip-width apart, arms a little away from your sides.",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function scanPhotoPath(userId: string, scanId: string, pose: ScanPose, fileId: string): string {
  return `${userId}/${scanId}/${pose}-${fileId}.jpg`;
}

/** True only for "<userId>/<scanId>/<pose>-<uuid>.jpg" in the owner's folder for this scan. */
export function isOwnScanPath(userId: string, scanId: string, pose: ScanPose, path: string): boolean {
  if (!new RegExp(`^${UUID}$`, "i").test(userId) || !new RegExp(`^${UUID}$`, "i").test(scanId)) return false;
  return new RegExp(`^${userId.toLowerCase()}/${scanId.toLowerCase()}/${pose}-${UUID}\\.jpg$`).test(path);
}

export const SCAN_MEASUREMENTS = ["waist", "chest", "hips", "arm", "thigh"] as const;
export type ScanMeasurement = (typeof SCAN_MEASUREMENTS)[number];
export const SCAN_MEASUREMENT_LABELS: Record<ScanMeasurement, string> = { waist: "Waist", chest: "Chest", hips: "Hips", arm: "Arm", thigh: "Thigh" };

export interface ScanSummary {
  id: string;
  takenOn: string;
  weightKg: number | null;
  /** In centimetres. */
  measurements: Partial<Record<ScanMeasurement, number>>;
  photos: Partial<Record<ScanPose, string | null>>;
  note: string | null;
}

/** Differences between two scans (later minus earlier), only where both have a value. */
export function compareScans(earlier: ScanSummary, later: ScanSummary): { days: number; weightKg: number | null; measurements: Partial<Record<ScanMeasurement, number>> } {
  const days = Math.round((Date.parse(`${later.takenOn}T00:00:00Z`) - Date.parse(`${earlier.takenOn}T00:00:00Z`)) / 86_400_000);
  const weightKg = earlier.weightKg != null && later.weightKg != null ? Math.round((later.weightKg - earlier.weightKg) * 10) / 10 : null;
  const measurements: Partial<Record<ScanMeasurement, number>> = {};
  for (const m of SCAN_MEASUREMENTS) {
    const a = earlier.measurements[m];
    const b = later.measurements[m];
    if (a != null && b != null) measurements[m] = Math.round((b - a) * 10) / 10;
  }
  return { days, weightKg, measurements };
}

/** The phone's tilt from upright (degrees) from a deviceorientation event's beta/gamma, or null when unknown. */
export function tiltFromUpright(beta: number | null | undefined, gamma: number | null | undefined): number | null {
  if (beta == null || gamma == null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  // Upright portrait is beta ≈ 90, gamma ≈ 0.
  return Math.round(Math.max(Math.abs(90 - Math.abs(beta)), Math.abs(gamma)));
}
