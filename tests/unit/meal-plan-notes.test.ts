import { MEAL_PLAN_INSTRUCTIONS, mealPlanNotesForAi } from "@/lib/domain/ai-meal-plan";

describe("AI meal plan notes", () => {
  it("passes ordinary preferences, dietary styles and substitutions through to the AI", () => {
    for (const note of [
      "quick breakfasts on weekdays, bigger dinner after training",
      "high protein, vegetarian, no mushrooms",
      "swap rice for potatoes when possible",
      "dairy-free please, I'm lactose intolerant",
      "cheap meals, I cook on Sundays for the week",
      "I want heart-healthy, low sugar snacks",
      "binge-watching night snack ideas",
      "keto style, more fish, nut allergy",
    ])
      expect(mealPlanNotesForAi(note), note).toEqual({ notes: note, medical: false });
  });

  it("keeps notes describing a medical condition or therapeutic diet away from the AI", () => {
    for (const note of [
      "I have type 2 diabetes",
      "low potassium for my kidney disease",
      "I'm pregnant, what should I eat",
      "recovering from an eating disorder",
      "my doctor put me on a low sodium diet",
      "I take warfarin",
      "heart disease, low cholesterol",
    ])
      expect(mealPlanNotesForAi(note), note).toEqual({ notes: null, medical: true });
    expect(mealPlanNotesForAi("   ")).toEqual({ notes: null, medical: false });
    expect(mealPlanNotesForAi(null)).toEqual({ notes: null, medical: false });
  });

  it("tells the AI to keep plans general wellness nutrition and never go below the calorie target", () => {
    expect(MEAL_PLAN_INSTRUCTIONS).toMatch(/not medical nutrition therapy/);
    expect(MEAL_PLAN_INSTRUCTIONS).toMatch(/Never aim below the daily calorie target/);
    expect(MEAL_PLAN_INSTRUCTIONS).toMatch(/Follow the plan focus and the member's notes/);
  });
});
