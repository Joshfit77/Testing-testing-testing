import { describe, expect, it } from "vitest";
import { aiMealPlanOutputSchema } from "@/lib/domain/ai-meal-plan";
import { foodPhotoOutputSchema } from "@/lib/domain/food-photo";
import { productExplanationSchema } from "@/lib/food-quality-ai";
import { isToolName, validateToolInput } from "@/lib/coach/tools";
import { SIMULATED_LABEL, simulatedChat, simulatedStructured, sseEvents, type SimRequest } from "@/lib/demo/simulated-ai";
import { aiPlanOutputSchema, validateAiPlan } from "@/lib/validation/ai";

/** The demo's scripted AI stand-in: always labelled, and always in shapes the real app accepts. */

const ask = (text: string): SimRequest => ({ model: "m", stream: true, system: [{ type: "text", text: "" }], messages: [{ role: "user", content: text }] });

describe("simulated coach chat", () => {
  it("labels every text reply as simulated", () => {
    const r = simulatedChat(ask("hello"));
    expect(r.stop).toBe("end_turn");
    expect(r.blocks[0]).toMatchObject({ type: "text" });
    expect((r.blocks[0] as { text: string }).text).toContain(SIMULATED_LABEL);
  });

  it.each(["Review my training", "How did I sleep?", "Swap my next exercise", "Set new macro targets", "Plan a recovery week", "Remember that I train at 6 am", "Why has my bench stalled?", "What did I eat?"])(
    "'%s' calls a real app tool with valid input",
    (text) => {
      const r = simulatedChat(ask(text));
      expect(r.stop).toBe("tool_use");
      const call = r.blocks[0] as { type: string; name: string; input: unknown };
      expect(call.type).toBe("tool_use");
      expect(isToolName(call.name)).toBe(true);
      if (isToolName(call.name)) expect(validateToolInput(call.name, call.input).ok).toBe(true);
    },
  );

  it("summarizes a tool result with a labelled reply", () => {
    const first = simulatedChat(ask("Review my training"));
    const call = first.blocks[0] as { id: string; name: string; input: Record<string, unknown> };
    const r = simulatedChat({
      model: "m",
      messages: [
        { role: "user", content: "Review my training" },
        { role: "assistant", content: [{ type: "tool_use", id: call.id, name: call.name, input: call.input }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: "{}" }] },
      ],
    });
    expect(r.stop).toBe("end_turn");
    expect((r.blocks[0] as { text: string }).text).toContain(SIMULATED_LABEL);
  });

  it("streams as Messages API events ending in message_stop", () => {
    const events = sseEvents("m", simulatedChat(ask("hi")).blocks, "end_turn");
    expect(events[0]!.type).toBe("message_start");
    expect(events.at(-1)!.type).toBe("message_stop");
  });
});

describe("simulated structured features", () => {
  it("drafts a training plan that passes the app's own safety and format checks", () => {
    const catalog = ["back-squat", "romanian-deadlift", "walking-lunge", "bench-press", "barbell-row", "overhead-press", "conventional-deadlift", "pull-up", "goblet-squat"]
      .map((s) => `${s} | Name | equipment: barbell | intermediate`)
      .join("\n");
    const out = simulatedStructured({ model: "m", system: [{ type: "text", text: `Plan mode: create a training plan for this athlete as structured output.\n\nExercise catalog (slug | name | equipment | difficulty):\n${catalog}` }], messages: [{ role: "user", content: "Make me a plan" }] });
    const parsed = aiPlanOutputSchema.parse(out);
    expect(parsed.reply).toContain(SIMULATED_LABEL);
    const known = new Set(catalog.split("\n").map((l) => l.split(" | ")[0]!));
    expect(validateAiPlan(parsed.plan, known).ok).toBe(true);
  });

  it("builds a meal plan only from the dishes it was given", () => {
    const user = "Plan 3 days.\nSlots: 0: Breakfast (breakfast, 600 kcal); 1: Dinner (dinner, 800 kcal);\napp:oats | Oats | breakfast\napp:salmon | Salmon | lunch/dinner\napp:eggs | Eggs | breakfast";
    const out = aiMealPlanOutputSchema.parse(simulatedStructured({ model: "m", system: "You arrange meal plans inside a fitness app.", messages: [{ role: "user", content: user }] }));
    expect(out.days).toHaveLength(3);
    for (const d of out.days) for (const m of d.meals) expect(["app:oats", "app:salmon", "app:eggs"]).toContain(m.dish_key);
    expect(out.summary).toContain(SIMULATED_LABEL);
  });

  it("says a food photo wasn't analysed", () => {
    const out = foodPhotoOutputSchema.parse(simulatedStructured({ model: "m", system: "You estimate the nutrition of a meal from one photo for a fitness app.", messages: [{ role: "user", content: "photo" }] }));
    expect(out.summary).toContain("not analysed");
    expect(out.items.every((i) => i.confidence === "low")).toBe(true);
  });

  it("labels a product explanation as simulated", () => {
    const out = productExplanationSchema.parse(simulatedStructured({ model: "m", system: "You explain a packaged food to a member.", messages: [{ role: "user", content: "x" }] }));
    expect(out.summary).toContain(SIMULATED_LABEL);
  });

  it("returns nothing for requests it doesn't know", () => {
    expect(simulatedStructured({ model: "m", system: "Something else", messages: [{ role: "user", content: "x" }] })).toBeNull();
  });
});
