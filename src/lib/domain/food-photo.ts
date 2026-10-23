import { z } from "zod";

/**
 * AI food-photo recognition (Pro): the model's answer format, the rules applied to it before the member sees it, and
 * the instructions it gets. Everything from a photo is an ESTIMATE: the member corrects every value and confirms
 * before anything reaches the diary.
 */

export const QUESTION_TOPICS = ["cooking_oil", "butter", "dressing", "sauce", "hidden_ingredient", "portion", "other"] as const;
export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

export const foodPhotoOutputSchema = z.object({
  is_food: z.boolean().describe("False if the photo doesn't show food or drink."),
  summary: z.string().describe("One sentence describing the meal as seen."),
  items: z.array(
    z.object({
      name: z.string().describe("A plain food name, e.g. 'Grilled chicken breast'."),
      visible_ingredients: z.array(z.string()),
      portion: z.string().describe("The estimated amount in words, e.g. 'about 1 cup' or 'a palm-sized fillet'."),
      grams: z.number().nullable().describe("Estimated weight in grams, or null if you can't judge it."),
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      confidence: z.enum(["low", "medium", "high"]),
      search_term: z.string().describe("A short term to find this food in a nutrition database, e.g. 'chicken breast grilled'."),
    }),
  ),
  questions: z.array(z.object({ topic: z.enum(QUESTION_TOPICS), question: z.string() })).describe("What you can't see but matters: oils, butter, dressings, sauces, hidden ingredients, unclear portions."),
});
export type FoodPhotoOutput = z.infer<typeof foodPhotoOutputSchema>;

export const FOOD_PHOTO_INSTRUCTIONS = `You estimate the nutrition of a meal from one photo for a fitness app. The member will check and correct everything before it is logged, so be honest about uncertainty.

Rules:
- List each distinct food or drink you can see as its own item. Don't invent foods you can't see.
- Estimate portions from visual cues (plate size, utensils, hands). Give grams only when you can reasonably judge them; otherwise null.
- Calories and macros are rough estimates for the portion you describe. Keep them consistent (protein and carbs about 4 kcal per gram, fat about 9).
- Use confidence "low" whenever the food, its preparation or the portion is unclear.
- Always ask about what a photo can't show: cooking oil or butter, dressings, sauces, sugar, and hidden ingredients (fillings, toppings under other food). Ask about portions you're unsure of.
- If the photo shows no food or drink, set is_food to false and return no items.
- Never claim precision you don't have. Never give medical or allergy advice.`;

export const CONFIDENCE_LABELS: Record<"low" | "medium" | "high", string> = { low: "Low confidence", medium: "Medium confidence", high: "Fairly confident" };

export interface PhotoEstimate {
  name: string;
  ingredients: string[];
  portion: string;
  grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "low" | "medium" | "high";
  searchTerm: string;
  /** Calories and macros disagree by a lot: the member should check them. */
  inconsistent: boolean;
}

export interface PhotoAnalysis {
  isFood: boolean;
  summary: string;
  items: PhotoEstimate[];
  questions: { topic: QuestionTopic; question: string }[];
}

const clip = (s: string, n: number) => s.trim().replace(/\s+/g, " ").slice(0, n);
const num = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v * 10) / 10)) : 0);

/** Calories implied by the macros (4/4/9). */
export function macroCalories(p: number, c: number, f: number): number {
  return p * 4 + c * 4 + f * 9;
}

const STANDARD_QUESTIONS: { topic: QuestionTopic; question: string; covers: QuestionTopic[] }[] = [
  { topic: "cooking_oil", question: "Was any of it cooked in oil or butter? A tablespoon of oil adds about 120 kcal that a photo can't show.", covers: ["cooking_oil", "butter"] },
  { topic: "sauce", question: "Any dressing, sauce, gravy or sugar that isn't visible?", covers: ["sauce", "dressing"] },
];

/**
 * Make the model's answer safe to show: drop empty or absurd items, clamp numbers, flag calories that don't match
 * the macros, and always ask about oil/butter and sauces/dressings (the usual hidden calories), plus portions when
 * any item is uncertain.
 */
export function normalizeFoodPhoto(out: FoodPhotoOutput): PhotoAnalysis {
  const items: PhotoEstimate[] = [];
  if (out.is_food) {
    for (const i of out.items.slice(0, 12)) {
      const name = clip(i.name, 120);
      if (!name) continue;
      const protein = num(i.protein_g, 300);
      const carbs = num(i.carbs_g, 500);
      const fat = num(i.fat_g, 300);
      const calories = num(i.calories, 4000);
      const implied = macroCalories(protein, carbs, fat);
      items.push({
        name,
        ingredients: i.visible_ingredients.map((x) => clip(x, 60)).filter(Boolean).slice(0, 12),
        portion: clip(i.portion, 120) || "Portion unclear",
        grams: i.grams != null && Number.isFinite(i.grams) && i.grams > 0 ? Math.min(3000, Math.round(i.grams)) : null,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        confidence: i.confidence,
        searchTerm: clip(i.search_term || i.name, 80),
        inconsistent: Math.abs(implied - calories) > Math.max(60, calories * 0.25),
      });
    }
  }
  const questions: PhotoAnalysis["questions"] = [];
  const seen = new Set<QuestionTopic>();
  for (const q of out.questions) {
    const text = clip(q.question, 200);
    if (!text || seen.has(q.topic)) continue;
    seen.add(q.topic);
    questions.push({ topic: q.topic, question: text });
  }
  if (items.length) {
    for (const s of STANDARD_QUESTIONS) {
      if (s.covers.some((t) => seen.has(t))) continue;
      questions.push({ topic: s.topic, question: s.question });
      seen.add(s.topic);
    }
    if (!seen.has("portion") && items.some((i) => i.confidence === "low" || i.grams == null)) {
      questions.push({ topic: "portion", question: "Some portions are hard to judge from a photo. Weigh or adjust the amounts if you can." });
    }
  }
  return { isFood: Boolean(out.is_food) && items.length > 0, summary: clip(out.summary, 300), items, questions: questions.slice(0, 8) };
}

/**
 * Hidden extras a member can add in one tap. Values come from the app's own USDA records (FoodData Central SR Legacy),
 * logged through the normal food path so the server recomputes them.
 */
const FATS: QuestionTopic[] = ["cooking_oil", "butter"];
const DRESSINGS: QuestionTopic[] = ["dressing", "sauce"];
export const HIDDEN_EXTRAS: { key: string; label: string; fdcId: string; grams: number; topics: QuestionTopic[] }[] = [
  { key: "olive-oil-tsp", label: "Olive oil, 1 tsp", fdcId: "171413", grams: 4.5, topics: FATS },
  { key: "olive-oil-tbsp", label: "Olive oil, 1 tbsp", fdcId: "171413", grams: 13.5, topics: FATS },
  { key: "butter-tsp", label: "Butter, 1 tsp", fdcId: "173410", grams: 4.7, topics: FATS },
  { key: "butter-tbsp", label: "Butter, 1 tbsp", fdcId: "173410", grams: 14.2, topics: FATS },
  { key: "ranch-2tbsp", label: "Ranch dressing, 2 tbsp", fdcId: "173592", grams: 30, topics: DRESSINGS },
  { key: "italian-2tbsp", label: "Italian dressing, 2 tbsp", fdcId: "171019", grams: 29.4, topics: DRESSINGS },
];

/** Largest photo the server accepts (the app resizes before upload, so real uploads are far smaller). */
export const FOOD_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Longest edge sent to the AI: enough to recognise food, small enough to keep image tokens (cost) low. */
export const FOOD_PHOTO_MAX_DIMENSION = 1024;

/** Image type from its first bytes (never trust the declared type). */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
