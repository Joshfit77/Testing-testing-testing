import { EMPTY_WEEK_MESSAGE, canCheckIn, practiceSentence, practicesByDate, weeklyPracticeSummary, type Practice } from "@/lib/domain/practices";

// 2026-10-21 is a Wednesday; its week runs Mon 19 – Sun 25.
const TODAY = "2026-10-21";
const prayer: Practice = { id: "p", practice: "prayer", title: "Prayer" };
const scripture: Practice = { id: "s", practice: "scripture", title: "Scripture reading" };
const custom: Practice = { id: "c", practice: "custom", title: "Memorise a verse" };

/** Words that would turn spiritual practice into a score or competition (SPEC §12, 12.18). */
const SCORING = /streak|score|point|rank|level|%|percent|best|behind|missed|fail|leader|than others|badge/i;

describe("daily practice wording", () => {
  it("counts distinct days this week, in gentle words", () => {
    const checkins = [
      { goalId: "p", date: "2026-10-19" },
      { goalId: "p", date: "2026-10-20" },
      { goalId: "p", date: "2026-10-20" }, // duplicate day counts once
      { goalId: "p", date: "2026-10-21" },
      { goalId: "p", date: "2026-10-18" }, // last week: not counted
      { goalId: "s", date: "2026-10-21" },
    ];
    expect(weeklyPracticeSummary([prayer, scripture], checkins, TODAY)).toEqual([
      "You spent time in prayer 3 days this week.",
      "You spent time in Scripture 1 day this week.",
    ]);
  });

  it("matches the example sentence and names custom practices", () => {
    expect(practiceSentence(prayer, 4)).toBe("You spent time in prayer 4 days this week.");
    expect(practiceSentence(custom, 2)).toBe("You made time for “Memorise a verse” 2 days this week.");
  });

  it("leaves out practices with no days and never shows zero or a comparison", () => {
    const lines = weeklyPracticeSummary([prayer, scripture], [{ goalId: "s", date: "2026-10-20" }], TODAY);
    expect(lines).toEqual(["You spent time in Scripture 1 day this week."]);
    expect(lines.join(" ")).not.toMatch(/\b0\b/);
  });

  it("is kind when nothing is checked off", () => {
    expect(weeklyPracticeSummary([prayer], [], TODAY)).toEqual([EMPTY_WEEK_MESSAGE]);
    expect(weeklyPracticeSummary([], [], TODAY)).toEqual([EMPTY_WEEK_MESSAGE]);
  });

  it("never uses scoring, streak or ranking language", () => {
    const all: Practice[] = (["scripture", "prayer", "gratitude", "fasting", "worship", "rest"] as const).map((k) => ({ id: k, practice: k, title: k }));
    const sentences = [...all, custom].flatMap((p) => [1, 3, 7].map((n) => practiceSentence(p, n)));
    for (const s of [...sentences, EMPTY_WEEK_MESSAGE]) expect(s).not.toMatch(SCORING);
  });

  it("groups practice labels by day for the history calendar", () => {
    const m = practicesByDate([prayer, custom], [
      { goalId: "p", date: "2026-10-01" },
      { goalId: "c", date: "2026-10-01" },
      { goalId: "gone", date: "2026-10-02" },
    ]);
    expect(m.get("2026-10-01")).toEqual(["Prayer", "Memorise a verse"]);
    expect(m.has("2026-10-02")).toBe(false);
  });

  it("allows check-offs for today and the previous six days only", () => {
    expect(canCheckIn(TODAY, TODAY)).toBe(true);
    expect(canCheckIn("2026-10-15", TODAY)).toBe(true);
    expect(canCheckIn("2026-10-14", TODAY)).toBe(false);
    expect(canCheckIn("2026-10-22", TODAY)).toBe(false);
  });
});
