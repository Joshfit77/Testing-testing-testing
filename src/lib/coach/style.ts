/**
 * Optional coaching styles (pure). A style changes tone and depth only: every style follows the same accuracy,
 * privacy and safety rules in the system prompt, uses the same data and tools, and needs the same approvals. The
 * instruction goes in the member's own (uncached) system block, so it never changes the shared cached prefix.
 */
export const COACH_STYLES = ["supportive", "direct", "beginner", "technical"] as const;
export type CoachStyle = (typeof COACH_STYLES)[number];

export const COACH_STYLE_LABELS: Record<CoachStyle, { label: string; description: string }> = {
  supportive: { label: "Supportive coach", description: "Warm and encouraging, celebrates consistency, frames setbacks gently." },
  direct: { label: "Direct performance coach", description: "Brief and to the point: the numbers, the call, and why." },
  beginner: { label: "Beginner educator", description: "Explains the why in plain words, defines terms, one step at a time." },
  technical: { label: "Technical strength coach", description: "Uses training terminology: RPE, e1RM, volume landmarks, periodization." },
};

const INSTRUCTIONS: Record<CoachStyle, string> = {
  supportive:
    "Coaching style the athlete chose: supportive. Be warm and encouraging; notice consistency and effort; frame setbacks as normal and fixable. Praise only what the data shows, never exaggerate, and still say plainly when something needs to change.",
  direct:
    "Coaching style the athlete chose: direct performance coach. Lead with the answer and the numbers, keep it short, give a clear recommendation and the one-line reason. No filler, no pep talk.",
  beginner:
    "Coaching style the athlete chose: beginner educator. Explain why, in plain words; define any training term the first time you use it; give one or two clear next steps rather than many options.",
  technical:
    "Coaching style the athlete chose: technical strength coach. Use precise terminology (RPE/RIR, e1RM, hard sets per muscle per week, progression models, fatigue management) and show the reasoning from their data.",
};

export function parseCoachStyle(v: unknown): CoachStyle | null {
  return typeof v === "string" && (COACH_STYLES as readonly string[]).includes(v) ? (v as CoachStyle) : null;
}

/** The instruction for the member's chosen style, or null for the default voice. */
export function coachStyleInstruction(style: CoachStyle | null): string | null {
  return style ? `${INSTRUCTIONS[style]} The style never changes the facts, the safety rules or what needs the athlete's approval.` : null;
}
