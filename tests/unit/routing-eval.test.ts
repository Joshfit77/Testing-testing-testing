import { describe, expect, it } from "vitest";
import { classifyCoachMessage } from "@/lib/coach/routing";

/**
 * A labelled routing set (owner brief 2026-11-13, Priority 3): routine questions stay on the fast model; the advanced
 * model is reserved for program design, multi-week analysis, plateaus, complicated trade-offs and anything about pain,
 * injury or a medical condition. Length alone never escalates. This checks the router, not answer quality; answer
 * quality per model is compared by the live harness (scripts/ai-eval, --live), which needs an approved key.
 */
const QUICK = [
  "How many sets should I do for biceps?",
  "What's a good warm-up before squats?",
  "Can I swap barbell rows for dumbbell rows today?",
  "Is it fine to train two days in a row?",
  "What does RPE 8 mean?",
  "How much protein is in a chicken breast?",
  "Should I eat before a morning workout?",
  "Explain what a superset is.",
  "How long should I rest between sets of bench?",
  "I only have dumbbells today, what can I do instead of leg press?",
  "Did I hit my protein yesterday?",
  "What's my next workout?",
  "How do I log a drop set?",
  "Give me a quick bench cue.",
  "What does John 3:16 mean for how I train?",
  `What should I eat before a morning workout? ${"I usually wake at six and train at seven. ".repeat(25)}`,
  "Thanks coach!",
  "How many calories did I eat today?",
  "What's the difference between a Romanian and a conventional deadlift?",
  "Is creatine safe to take every day?",
];
const COMPLEX = [
  "Design me a 12-week powerlifting program for my first meet",
  "Can you build a plan around my new night shifts?",
  "Restructure my program so I train upper/lower four days a week",
  "Why has my squat plateaued for two months?",
  "Review my last six weeks of training",
  "Analyze my bench trend since September",
  "My knee hurts when I squat, what should I change?",
  "I have type 2 diabetes, how should I fuel long runs?",
  "I'm pregnant, can I keep deadlifting?",
  "I felt chest pain during intervals yesterday",
  "My deadlift has stalled even though I added volume",
  "Adjust my program: I can only train three days now",
];

describe("model routing evaluation set", () => {
  it("keeps every routine question on the fast model, whatever its length", () => {
    const wrong = QUICK.filter((m) => classifyCoachMessage(m) !== "quick");
    expect(wrong).toEqual([]);
  });

  it("sends program design, multi-week analysis, plateaus and health questions to the advanced model", () => {
    const wrong = COMPLEX.filter((m) => classifyCoachMessage(m) !== "complex");
    expect(wrong).toEqual([]);
  });
});
