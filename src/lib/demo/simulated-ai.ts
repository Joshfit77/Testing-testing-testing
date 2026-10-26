/**
 * The demo's stand-in for the AI provider. It speaks the Messages API format so the real app code runs end to end
 * (allowance, consent, tools, approval cards), but every word comes from this script, never from a model, and every
 * reply says so. Read-only tools still run against the demo account's sample data; the script only summarizes them.
 */

export const SIMULATED_LABEL = "Simulated demo reply — written by a script, not an AI model.";

export type SimBlock = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
type Content = string | { type: string; [k: string]: unknown }[];
export interface SimRequest {
  model: string;
  system?: string | { type: string; text: string }[];
  messages: { role: string; content: Content }[];
  stream?: boolean;
}

let seq = 0;
const id = (prefix: string) => `${prefix}_demo_${Date.now().toString(36)}${(++seq).toString(36)}`;
const labelled = (text: string) => `*${SIMULATED_LABEL}*\n\n${text}`;
const systemText = (req: SimRequest) => (typeof req.system === "string" ? req.system : (req.system ?? []).map((b) => b.text).join("\n"));
const textOf = (c: Content | undefined) =>
  typeof c === "string" ? c : (c ?? []).filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("\n");

const TOOL_SUMMARY: Record<string, string> = {
  get_training_review:
    "I ran the app's training review on your logged workouts. It compares your sessions with your plan, counts weekly sets per muscle group, tracks estimated 1-rep maxes and flags lifts that have stalled. The **Progress** screen shows the same numbers.",
  get_exercise_history:
    "I pulled your logged sets for that lift. A common next step after hitting every rep at the same load is a small jump (2.5 kg / 5 lb on upper-body lifts). Ask me to **set a target** and I'll put one on a card for you to accept.",
  get_sleep_summary:
    "I checked your recent nights from the Sleep log. The **Sleep & Recovery** screen shows your average time asleep, consistency and the estimated sleep debt. Nights marked as from a watch are sample data in this demo.",
  get_nutrition_summary:
    "I checked your food log against your targets. The **Food** tab shows today's calories and macros and what's left.",
  get_recent_workouts: "I looked over your recent workouts. Your training calendar on **Train** shows each session.",
  get_program_week: "I looked at this week of your program on **Train**.",
};

/** Streamed chat: a scripted reply, or a tool call the app runs for real (read tools) or shows as a card (proposals). */
export function simulatedChat(req: SimRequest): { blocks: SimBlock[]; stop: "end_turn" | "tool_use" } {
  const last = req.messages.at(-1);
  const toolResult = Array.isArray(last?.content) ? last.content.find((c) => c.type === "tool_result") : undefined;
  if (toolResult) {
    const prev = req.messages.at(-2);
    const call = Array.isArray(prev?.content) ? prev.content.find((c) => c.type === "tool_use" && c.id === toolResult.tool_use_id) : undefined;
    const name = String(call?.name ?? "");
    const summary = TOOL_SUMMARY[name] ?? "I've put a suggested change below. Nothing changes until you tap **Confirm**.";
    return { stop: "end_turn", blocks: [{ type: "text", text: labelled(summary) }] };
  }
  const text = textOf(last?.content).toLowerCase();
  const tool = (name: string, input: Record<string, unknown>): { blocks: SimBlock[]; stop: "tool_use" } => ({
    stop: "tool_use",
    blocks: [{ type: "tool_use", id: id("toolu"), name, input }],
  });
  if (/review|how am i doing|progress/.test(text)) return tool("get_training_review", {});
  if (/sleep|tired|rest/.test(text)) return tool("get_sleep_summary", { days: 14 });
  if (/recovery week|deload|lighter week/.test(text)) {
    return tool("propose_deload_week", { keep_percent_of_sets: 60, rpe_cap: 7, reason: "Simulated demo suggestion: a lighter week after several hard ones." });
  }
  if (/remember/.test(text)) return tool("propose_memory", { category: "schedule", content: "Trains at 6 am before work." });
  if (/swap|replace|substitute/.test(text)) {
    const from = systemText(req).match(/← next: [^[]*\[([a-z0-9-]+)\]/)?.[1] ?? "back-squat";
    return tool("propose_exercise_swap", {
      from_exercise_slug: from,
      to_exercise_slug: from === "goblet-squat" ? "leg-press" : "goblet-squat",
      scope: "next_workout",
      reason: "Simulated demo suggestion: a joint-friendly option for today.",
    });
  }
  if (/target|macro|calorie|protein/.test(text)) {
    return tool("propose_nutrition_targets", { calories: 2600, protein_g: 185, carbs_g: 290, fat_g: 78, reason: "Simulated demo suggestion: fuel for building strength." });
  }
  if (/food|eat|meal/.test(text)) return tool("get_nutrition_summary", { days: 7 });
  if (/bench|squat|deadlift|press|lift/.test(text)) {
    const exercise = text.includes("squat") ? "back-squat" : text.includes("deadlift") ? "conventional-deadlift" : text.includes("overhead") ? "overhead-press" : "bench-press";
    return tool("get_exercise_history", { exercise, sessions: 6 });
  }
  return {
    stop: "end_turn",
    blocks: [
      {
        type: "text",
        text: labelled(
          "In the live app, the AI coach answers questions about your training, food, sleep and recovery using your own log, and suggests changes you approve. In this demo, try:\n\n- **Review my training**\n- **How did I sleep?**\n- **Swap my next exercise**\n- **Set new macro targets**\n- **Plan a recovery week**\n- **Remember that I train at 6 am**",
        ),
      },
    ],
  };
}

const PLAN_DAYS: { name: string; focus: string; lifts: [string, number, string][] }[] = [
  { name: "Day 1 — Lower", focus: "Squat strength", lifts: [["back-squat", 4, "5"], ["romanian-deadlift", 3, "8"], ["walking-lunge", 3, "10 per side"]] },
  { name: "Day 2 — Upper", focus: "Press and pull", lifts: [["bench-press", 4, "5"], ["barbell-row", 4, "8"], ["overhead-press", 3, "8"]] },
  { name: "Day 3 — Full body", focus: "Hinge and carry", lifts: [["conventional-deadlift", 3, "5"], ["pull-up", 3, "AMRAP"], ["goblet-squat", 3, "10"]] },
];

/** Non-streamed structured output (messages.parse), by feature. Returns null for anything the demo doesn't cover. */
export function simulatedStructured(req: SimRequest): Record<string, unknown> | null {
  const system = systemText(req);
  const user = textOf(req.messages[0]?.content);
  if (system.includes("Plan mode: create a training plan")) {
    const known = new Set([...system.matchAll(/^([a-z0-9-]+) \| /gm)].map((m) => m[1]!));
    const days = PLAN_DAYS.map((d) => ({
      name: d.name,
      focus: d.focus,
      exercises: d.lifts
        .filter(([slug]) => known.size === 0 || known.has(slug))
        .map(([slug, sets, reps]) => ({ exercise_slug: slug, sets, reps, seconds: null, rest_seconds: 120, rpe: 7.5, notes: null })),
    })).filter((d) => d.exercises.length > 0);
    return {
      reply: labelled("Here's a sample three-day plan. Review it below and save it only if you want it."),
      plan: {
        name: "Demo Strength Plan",
        summary: "A simulated three-day strength plan (fixed sample, not written by an AI model).",
        weeks: 6,
        session_minutes: 60,
        difficulty: "intermediate",
        progression: "Add 2.5 kg to upper-body lifts and 5 kg to lower-body lifts when every set hits the top of the rep range.",
        days,
      },
    };
  }
  if (system.includes("You explain a packaged food")) {
    return {
      summary: `${SIMULATED_LABEL} In the live app, the AI relates this product's nutrition label to your goals and targets.`,
      fits: ["Simulated: a real explanation lists how the product fits your goals, each point tied to a number from the label."],
      watch_outs: ["Simulated: a real explanation lists what to keep in mind, such as sugar or sodium against your day."],
      uncertainties: ["This demo reply wasn't based on the product's data."],
    };
  }
  if (system.includes("You estimate the nutrition of a meal from one photo")) {
    const it = (name: string, portion: string, grams: number, calories: number, p: number, c: number, f: number, search_term: string) => ({
      name,
      visible_ingredients: [name.toLowerCase()],
      portion,
      grams,
      calories,
      protein_g: p,
      carbs_g: c,
      fat_g: f,
      confidence: "low",
      search_term,
    });
    return {
      is_food: true,
      summary: `${SIMULATED_LABEL} The photo was not analysed; these are fixed sample items for you to review and edit.`,
      items: [
        it("Grilled chicken breast", "a palm-sized fillet", 150, 248, 46, 0, 5, "chicken breast"),
        it("White rice", "about 1 cup", 160, 208, 4, 45, 0, "rice"),
        it("Broccoli", "a handful", 90, 31, 3, 6, 0, "broccoli"),
      ],
      questions: [{ topic: "sauce", question: "Was there any sauce or oil on the chicken?" }],
    };
  }
  if (system.includes("You arrange meal plans")) {
    const days = Number(user.match(/Plan (\d+) day/)?.[1] ?? 1);
    const slots = [...user.matchAll(/(\d+): [^(;]+\((breakfast|lunch|dinner|snack),/g)].map((m) => ({ index: Number(m[1]), slot: m[2]! }));
    const dishes = user
      .split("\n")
      .filter((l) => /^(app|recipe|meal):/.test(l))
      .map((l) => {
        const [key, , meals] = l.split(" | ");
        return { key: key!, meals: (meals ?? "").split("/") };
      });
    return {
      summary: `${SIMULATED_LABEL} Dishes were picked by a simple rotation from your list; the app computed all nutrition.`,
      days: Array.from({ length: days }, (_, day) => ({
        day_index: day,
        meals: slots.map((s) => {
          const options = dishes.filter((d) => d.meals.includes(s.slot));
          const pick = options[(day + s.index) % Math.max(1, options.length)];
          return { slot_index: s.index, dish_key: pick?.key ?? "app:none", portion: 1 };
        }),
      })),
      assumptions: ["Simulated demo plan: no AI model chose these dishes."],
    };
  }
  return null;
}

/** Messages API server-sent events for a streamed reply. */
export function sseEvents(model: string, blocks: SimBlock[], stopReason: string): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [
    {
      type: "message_start",
      message: { id: id("msg"), type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } },
    },
  ];
  blocks.forEach((b, index) => {
    if (b.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      for (const chunk of b.text.match(/[\s\S]{1,24}/g) ?? []) events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: chunk } });
    } else {
      events.push({ type: "content_block_start", index, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } });
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 0 } });
  events.push({ type: "message_stop" });
  return events;
}
