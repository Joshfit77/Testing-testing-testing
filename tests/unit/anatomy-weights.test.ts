import { describe, expect, it } from "vitest";
import { MEASURED_BIND } from "@/lib/anatomy3d/athlete-bind.generated";
import { BONES, muscleId, NO_MUSCLE } from "@/lib/anatomy3d/muscle-ids";
import { computeWeights, LIMB_CODE } from "../../scripts/anatomy/weights";

/** The dominant bone of one vertex at `p` (a degenerate triangle of three copies, so smoothing changes nothing). */
function boneAt(p: [number, number, number], label: number, limb = 0): string {
  const pos = new Float32Array([...p, ...p, ...p]);
  const { skinIndex, skinWeight } = computeWeights(pos, [0, 1, 2], new Uint8Array(3).fill(label), MEASURED_BIND, undefined, undefined, new Uint8Array(3).fill(limb));
  let best = 0;
  for (let k = 1; k < 4; k++) if (skinWeight[k]! > skinWeight[best]!) best = k;
  return BONES[skinIndex[best]!]!;
}

describe("athlete skin weights", () => {
  // Right beside the resting right hand, on the outside of the thigh.
  const besideHand: [number, number, number] = [MEASURED_BIND.R.hand[0], MEASURED_BIND.R.hand[1] + 2, MEASURED_BIND.R.hand[2] - 4];

  it("binds unlabelled parts at the hand to the hand", () => {
    expect(boneAt(besideHand, NO_MUSCLE)).toBe("handR");
  });

  it("keeps a thigh muscle beside the hand on the leg", () => {
    expect(boneAt(besideHand, muscleId("vastusLat", 0))).toMatch(/^(thighR|pelvis)$/);
  });

  it("keeps an unlabelled part marked as leg on the leg", () => {
    expect(boneAt(besideHand, NO_MUSCLE, LIMB_CODE.leg)).toMatch(/^(thighR|pelvis)$/);
  });

  it("keeps the abdominal muscles off the arms", () => {
    const flank: [number, number, number] = [0, MEASURED_BIND.R.elbow[1], MEASURED_BIND.R.elbow[2] - 6];
    expect(boneAt(flank, muscleId("obliques", 0))).toMatch(/^(chest|pelvis)$/);
  });
});
