/**
 * The words the journey rule is explained in. Shown before joining, on the journey and on the Faith dashboard, so the
 * rule always reads the same. (Wording supplied by the owner; listed for theological review in docs/faith/REVIEW.md.)
 */
export const JOURNEY_RULE = "If you miss your daily Bible reading or prayer, your current journey restarts at Day 1. Your previous reading history and notes will still be saved.";

/** Shown when a journey has restarted. */
export const RESTART_MESSAGE = "Your journey begins again today. God's mercies are new every morning.";
export const RESTART_REFERENCE = "Lamentations 3:22–23";

/** The rule is a discipline, not a verdict. */
export const RULE_GRACE = "This is a discipline you choose. A restart is a fresh start at the habit; it does not change God's love for you.";

export const REASON_TEXT: Record<"reading" | "prayer" | "both", string> = {
  reading: "the Bible reading wasn't marked complete",
  prayer: "prayer wasn't marked complete",
  both: "neither the reading nor prayer was marked complete",
};
