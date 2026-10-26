import type { Region } from "../../src/lib/anatomy3d/muscle-ids";

/**
 * Maps a BodyParts3D part name (e.g. "acromial part of right deltoid") to the app's glow region. Parts that return
 * null are kept as plain anatomy without a glow region (face muscles); parts with "drop" are left out of the athlete.
 */
const RULES: [RegExp, Region | "drop" | null][] = [
  [/platysma|orbicularis|zygomaticus|masseter|temporalis|frontalis/, "drop"], // the face and front of the neck use the skin surface
  [/clavicular part of .*pectoralis major/, "pecUpper"],
  [/pectoralis (major|minor)/, "pecLower"],
  [/clavicular part of .*deltoid/, "deltAnt"],
  [/acromial part of .*deltoid/, "deltLat"],
  [/spinal part of .*deltoid/, "deltPost"],
  [/biceps brachii|coracobrachialis/, "biceps"],
  [/brachialis/, "brachialis"],
  [/triceps brachii|anconeus/, "triceps"],
  [/brachioradialis|flexor carpi|flexor digitorum superficialis|pronator teres|palmaris/, "forearmFlex"],
  [/extensor carpi|extensor digitorum$|extensor digiti minimi|abductor pollicis longus|extensor pollicis/, "forearmExt"],
  [/latissimus dorsi|teres major/, "lat"],
  [/descending part of .*trapezius/, "trapUpper"],
  [/trapezius/, "trapMid"],
  [/rhomboid/, "rhomboid"],
  [/infraspinatus|supraspinatus|teres minor|subscapularis/, "rotatorCuff"],
  [/serratus anterior/, "serratus"],
  [/oblique$/, "obliques"],
  [/rectus abdominis/, "abs"],
  [/iliocostalis|longissimus thoracis|spinalis thoracis/, "erector"],
  [/gluteus maximus/, "gluteMax"],
  [/gluteus (medius|minimus)|tensor fasciae latae/, "gluteMed"],
  [/iliacus|psoas|sartorius/, "hipFlexor"],
  [/adductor (brevis|longus|magnus)|gracilis|pectineus/, "adductors"],
  [/rectus femoris/, "rectusFemoris"],
  [/vastus (lateralis|intermedius)/, "vastusLat"],
  [/vastus medialis/, "vastusMed"],
  [/biceps femoris/, "bicepsFemoris"],
  [/semitendinosus|semimembranosus/, "semitendinosus"],
  [/gastrocnemius|plantaris/, "gastroc"],
  [/soleus|flexor digitorum longus/, "soleus"],
  [/tibialis anterior|extensor digitorum longus|extensor hallucis longus/, "tibialis"],
  [/fibularis/, "peroneus"],
  [/sternocleidomastoid|splenius|levator scapulae|semispinalis capitis/, "neck"],
];

export type PartKind = "muscle" | "bone" | "tendon";
/** What a BodyParts3D part is in the athlete, or null to leave it out. */
export function kindOf(name: string): PartKind | null {
  if (/tendon|iliotibial tract|inguinal ligament/.test(name)) return "tendon";
  if (/(\brib|costal cartilage|vertebra|sternum|manubrium|clavicle|scapula|humerus|radius|ulna|hip bone|sacrum|femur|patella|\btibia|fibula|talus|calcaneus|hyoid bone|thyroid cartilage)$/.test(name))
    return "bone";
  const r = regionOf(name);
  if (r === "drop") return null;
  if (r || /intercostal|sternohyoid|omohyoid|anconeus/.test(name)) return "muscle";
  return null;
}

export function regionOf(name: string): Region | "drop" | null {
  for (const [re, r] of RULES) if (re.test(name)) return r;
  return null;
}

/** 0 = the athlete's right, 1 = left, matching muscleId(). */
export const sideOf = (name: string): 0 | 1 => (/\bleft\b/.test(name) ? 1 : 0);
