import type { DietType } from "@/lib/domain/diets";

/**
 * Supplement reference list. Doses are typical adult ranges drawn from sports-nutrition position stands
 * and the NIH Office of Dietary Supplements; they are general information, not a prescription.
 */
export const SUPPLEMENT_CATEGORIES = ["performance", "protein", "health", "recovery"] as const;
export type SupplementCategory = (typeof SUPPLEMENT_CATEGORIES)[number];

export const SUPPLEMENT_CATEGORY_LABELS: Record<SupplementCategory, string> = {
  performance: "Performance",
  protein: "Protein",
  health: "Health & vitamins",
  recovery: "Recovery & sleep",
};

/** How well the main claim is backed by research. */
export type EvidenceLevel = "strong" | "moderate" | "limited";
export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  strong: "Strong evidence",
  moderate: "Some evidence",
  limited: "Limited evidence",
};

/** Animal-derived ingredients that rule a product out for some diets. */
export type SupplementSource = "dairy" | "fish" | "animal";

export interface Supplement {
  id: string;
  name: string;
  category: SupplementCategory;
  /** What people take it for, in one line. */
  purpose: string;
  dose: string;
  timing: string;
  evidence: EvidenceLevel;
  cautions: string;
  contains?: SupplementSource[];
  /** Suggested swap when `contains` rules it out. */
  alternative?: string;
}

export const SUPPLEMENTS: Supplement[] = [
  {
    id: "creatine",
    name: "Creatine monohydrate",
    category: "performance",
    purpose: "More strength, power and muscle gain from your training.",
    dose: "3–5 g a day",
    timing: "Any time of day, every day. No loading phase needed.",
    evidence: "strong",
    cautions: "May add 1–3 lb of water weight. Drink plenty of water. Ask a doctor first if you have kidney disease.",
  },
  {
    id: "whey",
    name: "Whey protein",
    category: "protein",
    purpose: "An easy way to reach your daily protein target.",
    dose: "20–40 g per serving",
    timing: "Whenever it helps you hit your protein goal, often after training.",
    evidence: "strong",
    cautions: "Contains milk. If lactose bothers you, try whey isolate.",
    contains: ["dairy"],
    alternative: "Plant protein (pea or soy blend)",
  },
  {
    id: "plant-protein",
    name: "Plant protein (pea or soy blend)",
    category: "protein",
    purpose: "Dairy-free protein to help reach your daily target.",
    dose: "25–40 g per serving",
    timing: "Whenever it helps you hit your protein goal.",
    evidence: "strong",
    cautions: "Choose a blend or soy for a complete amino-acid profile.",
  },
  {
    id: "casein",
    name: "Casein protein",
    category: "protein",
    purpose: "Slow-digesting protein, popular before bed.",
    dose: "30–40 g",
    timing: "In the evening or before bed.",
    evidence: "moderate",
    cautions: "Contains milk.",
    contains: ["dairy"],
    alternative: "Plant protein (pea or soy blend)",
  },
  {
    id: "caffeine",
    name: "Caffeine",
    category: "performance",
    purpose: "More energy, focus and endurance during training.",
    dose: "3–6 mg per kg of bodyweight (about 200–400 mg for most adults)",
    timing: "30–60 minutes before training. Avoid within 6–8 hours of bedtime.",
    evidence: "strong",
    cautions:
      "Stay under 400 mg a day from all sources (200 mg if pregnant). Skip it with heart conditions, high blood pressure or anxiety unless your doctor says it's fine.",
  },
  {
    id: "beta-alanine",
    name: "Beta-alanine",
    category: "performance",
    purpose: "Helps hard efforts lasting about 1–4 minutes (sprints, high-rep sets, rounds).",
    dose: "3.2–6.4 g a day, split into smaller doses",
    timing: "Daily with meals. It builds up over 4+ weeks.",
    evidence: "moderate",
    cautions: "A harmless tingling feeling is common. Smaller split doses reduce it.",
  },
  {
    id: "citrulline",
    name: "Citrulline malate",
    category: "performance",
    purpose: "May help you get more reps and reduce soreness.",
    dose: "6–8 g",
    timing: "About 60 minutes before training.",
    evidence: "limited",
    cautions: "Ask a doctor if you take blood-pressure or erectile-dysfunction medication.",
  },
  {
    id: "beetroot",
    name: "Beetroot juice (nitrate)",
    category: "performance",
    purpose: "Better endurance and efficiency in cardio and conditioning.",
    dose: "About 400–500 mg of nitrate (a 70 ml concentrated shot)",
    timing: "2–3 hours before training or competing.",
    evidence: "moderate",
    cautions: "Can turn urine pink (harmless). Antibacterial mouthwash blunts the effect. Ask a doctor if you take blood-pressure medication.",
  },
  {
    id: "sodium-bicarbonate",
    name: "Sodium bicarbonate",
    category: "performance",
    purpose: "Buffers acid during very intense efforts of 1–10 minutes.",
    dose: "0.2–0.3 g per kg of bodyweight",
    timing: "60–180 minutes before, with a carb-rich meal to limit stomach upset.",
    evidence: "moderate",
    cautions: "Stomach upset is common, so test it on a training day first. Very high in sodium: avoid with high blood pressure or kidney problems.",
  },
  {
    id: "electrolytes",
    name: "Electrolytes",
    category: "performance",
    purpose: "Replaces sodium lost in sweat during long or hot sessions, and while fasting or on keto.",
    dose: "About 300–600 mg sodium per hour of heavy sweating",
    timing: "During long or hot workouts, or daily on keto or fasting.",
    evidence: "moderate",
    cautions: "Watch total sodium if you have high blood pressure.",
  },
  {
    id: "vitamin-d",
    name: "Vitamin D3",
    category: "health",
    purpose: "Supports bones, muscles and immunity, especially if you get little sun.",
    dose: "1,000–2,000 IU a day",
    timing: "With a meal that contains fat.",
    evidence: "moderate",
    cautions: "A blood test shows whether you need it. Don't go over 4,000 IU a day without medical advice.",
  },
  {
    id: "omega-3",
    name: "Omega-3 fish oil",
    category: "health",
    purpose: "Heart health and general wellbeing if you rarely eat oily fish.",
    dose: "1–2 g of EPA + DHA a day",
    timing: "With meals.",
    evidence: "moderate",
    cautions: "Ask a doctor if you take blood thinners. Contains fish.",
    contains: ["fish"],
    alternative: "Algae oil (plant omega-3)",
  },
  {
    id: "algae-oil",
    name: "Algae oil (plant omega-3)",
    category: "health",
    purpose: "Fish-free EPA and DHA.",
    dose: "250–500 mg of EPA + DHA a day",
    timing: "With meals.",
    evidence: "moderate",
    cautions: "Ask a doctor if you take blood thinners.",
  },
  {
    id: "magnesium",
    name: "Magnesium",
    category: "recovery",
    purpose: "Helps if your diet is low in magnesium. Some people find it helps sleep.",
    dose: "200–350 mg a day from supplements",
    timing: "In the evening. Glycinate is gentlest on the stomach.",
    evidence: "limited",
    cautions: "High doses can cause diarrhea. Ask a doctor if you have kidney disease.",
  },
  {
    id: "multivitamin",
    name: "Multivitamin",
    category: "health",
    purpose: "Fills small gaps in a restricted or inconsistent diet.",
    dose: "1 serving a day as labelled",
    timing: "With a meal.",
    evidence: "limited",
    cautions: "Check the label before stacking it with other vitamins so you don't double up.",
  },
  {
    id: "vitamin-b12",
    name: "Vitamin B12",
    category: "health",
    purpose: "Essential on vegan and most plant-based diets.",
    dose: "25–100 mcg a day, or 1,000 mcg two to three times a week",
    timing: "Any time.",
    evidence: "strong",
    cautions: "Strongly recommended on a vegan diet. Ask a doctor about testing if you're tired or tingly.",
  },
  {
    id: "iron",
    name: "Iron",
    category: "health",
    purpose: "Only if a blood test shows you are low.",
    dose: "As your doctor advises",
    timing: "With vitamin C, away from coffee, tea and calcium.",
    evidence: "strong",
    cautions: "Don't take it unless a test shows you need it: too much is harmful. Keep it away from children.",
  },
  {
    id: "zinc",
    name: "Zinc",
    category: "health",
    purpose: "Helps only if your diet is low in zinc.",
    dose: "8–11 mg a day",
    timing: "With food.",
    evidence: "limited",
    cautions: "Stay under 40 mg a day. Long-term high doses lower copper.",
  },
  {
    id: "collagen",
    name: "Collagen + vitamin C",
    category: "recovery",
    purpose: "May support tendons and ligaments during rehab or jumping work.",
    dose: "15 g collagen with about 50 mg vitamin C",
    timing: "30–60 minutes before rehab or plyometric work.",
    evidence: "limited",
    cautions: "Not a complete protein, so don't count it fully toward your protein goal. Made from animals.",
    contains: ["animal"],
  },
  {
    id: "ashwagandha",
    name: "Ashwagandha",
    category: "recovery",
    purpose: "May lower stress and help sleep.",
    dose: "300–600 mg of root extract a day",
    timing: "With food, often in the evening.",
    evidence: "limited",
    cautions:
      "Avoid if pregnant or breastfeeding, or if you have thyroid or autoimmune conditions. Rare liver problems have been reported. Ask a doctor if you take sedatives or other medication.",
  },
  {
    id: "melatonin",
    name: "Melatonin",
    category: "recovery",
    purpose: "Helps you fall asleep, especially with jet lag or shift changes.",
    dose: "0.5–3 mg",
    timing: "30–60 minutes before bed, for short periods.",
    evidence: "moderate",
    cautions: "Can cause morning grogginess. Ask a doctor before long-term use or if you take other medication.",
  },
  {
    id: "tart-cherry",
    name: "Tart cherry juice",
    category: "recovery",
    purpose: "May reduce soreness during hard training blocks.",
    dose: "30 ml concentrate twice a day",
    timing: "For a few days around hard sessions or competition.",
    evidence: "limited",
    cautions: "Contains sugar. Count it in your food log.",
  },
  {
    id: "psyllium",
    name: "Psyllium fiber",
    category: "health",
    purpose: "Helps digestion and cholesterol if you eat little fiber.",
    dose: "5–10 g a day",
    timing: "With a full glass of water. Take medication 2 hours apart.",
    evidence: "strong",
    cautions: "Start low and drink plenty of water to avoid bloating.",
  },
  {
    id: "bcaa",
    name: "BCAAs",
    category: "recovery",
    purpose: "Popular, but not needed if you hit your daily protein.",
    dose: "5–10 g",
    timing: "Around training.",
    evidence: "limited",
    cautions: "Usually a better buy: whey or plant protein, which already contain BCAAs.",
  },
];

export const SUPPLEMENT_IDS = SUPPLEMENTS.map((s) => s.id);
const BY_ID = new Map(SUPPLEMENTS.map((s) => [s.id, s]));
export const getSupplement = (id: string): Supplement | undefined => BY_ID.get(id);

const EXCLUDED_SOURCES: Partial<Record<DietType, SupplementSource[]>> = {
  vegan: ["dairy", "fish", "animal"],
  daniel_fast: ["dairy", "fish", "animal"],
  vegetarian: ["fish", "animal"],
  pescatarian: ["animal"],
  paleo: ["dairy"],
};

/** False when the supplement contains something the diet excludes. */
export function supplementFitsDiet(s: Supplement, diet: DietType | null | undefined): boolean {
  if (!diet || !s.contains) return true;
  const excluded = EXCLUDED_SOURCES[diet] ?? [];
  return !s.contains.some((c) => excluded.includes(c));
}

export const SUPPLEMENT_DISCLAIMER =
  "Supplements aren't approved by the FDA before they're sold. Choose products tested by NSF Certified for Sport or Informed Sport, and talk to your doctor before starting anything new, especially if you're pregnant, under 18, have a medical condition or take medication.";
