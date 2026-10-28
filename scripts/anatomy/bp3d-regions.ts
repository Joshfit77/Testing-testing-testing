import { regionOf } from "../../src/lib/anatomy3d/muscle-ids";

export { regionOf, sideOf } from "../../src/lib/anatomy3d/muscle-ids";

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
