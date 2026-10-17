import { EQUIPMENT, type Equipment } from "./types";

/** Quick equipment setups shared by onboarding and the program builder. */
export const EQUIPMENT_PRESETS: { label: string; description: string; items: Equipment[] }[] = [
  {
    label: "Full gym",
    description: "Barbells, racks, machines, cables and dumbbells.",
    items: EQUIPMENT.filter((e) => e !== "heavy_bag" && e !== "strongman_implements") as Equipment[],
  },
  { label: "Home gym", description: "Barbell and rack, bench, dumbbells, pull-up bar.", items: ["barbell", "rack", "bench", "dumbbell", "pull_up_bar", "band", "kettlebell"] },
  { label: "Dumbbells only", description: "A pair of dumbbells, a bench and bands.", items: ["dumbbell", "bench", "band"] },
  { label: "Bodyweight only", description: "No equipment: just you and a mat.", items: ["bodyweight", "mat"] },
];
