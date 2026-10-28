/**
 * The exercises the app demonstrates with the 3D anatomical figure (src/lib/anatomy3d) instead of the animated
 * illustration (src/lib/exercise-motion).
 *
 * An exercise is listed here only after its rendered motion has been checked by the automated QA
 * (scripts/anatomy/qa/check-motion.mts) and approved by eye by the owner; docs/anatomy3d/LIBRARY_STATUS.md records
 * where every exercise stands. Every other exercise keeps the illustration, and the illustration stays for these too:
 * it is shown while the model downloads, it takes over when WebGL or the model's files are not available, and the
 * athlete can switch to it in the player.
 *
 * The kettlebell swing is the first candidate: it passes the automated checks and is in for the owner's visual
 * approval. Nothing else is to be added without that approval.
 */
export const IN_APP_3D: readonly string[] = ["kettlebell-swing"];

/** Whether the app shows the 3D anatomical demonstration for this exercise. */
export function has3dDemo(slug: string): boolean {
  return IN_APP_3D.includes(slug);
}
