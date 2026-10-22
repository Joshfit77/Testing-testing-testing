import { describe, expect, it } from "vitest";
import bsbFile from "@/data/bsb-passages.json";
import references from "../../scripts/bsb-references.json";
import { SCRIPTURES, TRANSLATION } from "@/data/content";
import { DEVOTIONALS } from "@/data/devotionals";
import { ACTIVE_TRANSLATION, BSB_FRAGMENTS, BSB_PASSAGES, scriptureFragment, scriptureText } from "@/data/scripture";
import { FAITH_REMINDER_INFO } from "@/lib/faith-reminders";
import { FAITH_ENABLED_INSTRUCTIONS, COACH_VERSES } from "@/lib/coach/knowledge";

const ARCHAIC = /\b(thee|thou|thy|thine|ye|hath|doth|unto|saith|shalt|leadeth|maketh|sheweth|strengtheneth|sharpeneth|whatsoever|whither|whithersoever)\b/i;

describe("Scripture is the official Berean Standard Bible text", () => {
  it("uses the BSB and attributes it with a link to berean.bible", () => {
    expect(ACTIVE_TRANSLATION.code).toBe("BSB");
    expect(TRANSLATION).toBe(ACTIVE_TRANSLATION);
    expect(ACTIVE_TRANSLATION.notice).toBe("Scripture quotations are from the Berean Standard Bible (BSB), public domain.");
    expect(ACTIVE_TRANSLATION.noticeUrl).toBe("https://berean.bible/");
  });

  it("comes from the official BSB file, with provenance recorded", () => {
    expect(bsbFile.translation).toBe("BSB");
    expect(bsbFile.source).toMatch(/^https:\/\/(bereanbible\.com|openbible\.com|berean\.bible)\//);
    expect(bsbFile.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(bsbFile.versesInFile).toBeGreaterThan(31000);
    for (const ref of references) expect(BSB_PASSAGES[ref], ref).toBeTruthy();
  });

  it("shows exactly the BSB wording for every daily verse and devotional", () => {
    for (const s of SCRIPTURES) {
      expect(references, s.reference).toContain(s.reference);
      expect(s.text, s.reference).toBe(BSB_PASSAGES[s.reference]);
    }
    for (const d of DEVOTIONALS) {
      expect(references, d.reference).toContain(d.reference);
      expect(d.scripture, `Day ${d.day}`).toBe(BSB_PASSAGES[d.reference]);
    }
  });

  it("keeps the source files in step with the BSB file (no stale KJV text left behind)", () => {
    for (const s of SCRIPTURES) expect(scriptureText(s.reference, s.text)).toBe(s.text);
  });

  it("quotes Scripture inside devotional prose only in BSB wording", () => {
    const quoted: [string, string][] = [
      ["Joshua 1:9", "be strong and courageous"],
      ["James 1:2–4", "Allow perseverance to finish its work"],
      ["Romans 5:5", "God has poured out His love into our hearts through the Holy Spirit"],
      ["2 Corinthians 12:9", "My grace is sufficient for you, for My power is perfected in weakness."],
      ["Psalm 139:14", "I am fearfully and wonderfully made."],
      ["Mark 6:31", "Come with Me privately to a solitary place, and let us rest for a while."],
      ["Psalm 23:1–3", "I shall not want."],
      ["Proverbs 27:17", "As iron sharpens iron, so one man sharpens another."],
      ["Philippians 4:12–13", "I can do all things through Christ who gives me strength"],
      ["1 Thessalonians 5:18", "Give thanks in every circumstance, for this is God’s will for you in Christ Jesus."],
      ["2 Timothy 4:7", "I have fought the good fight, I have finished the race, I have kept the faith."],
    ];
    const prose = DEVOTIONALS.map((d) => `${d.title} ${d.devotional} ${d.prayer}`).join(" ");
    for (const [ref, phrase] of quoted) {
      expect((BSB_PASSAGES[ref] ?? "").toLowerCase(), ref).toContain(phrase.toLowerCase());
    }
    // Romans 5:5 is paraphrased into the sentence; the rest appear in the devotionals as written.
    for (const [ref, phrase] of quoted.filter(([r]) => r !== "Romans 5:5")) expect(prose.toLowerCase(), ref).toContain(phrase.toLowerCase());
  });

  it("has no KJV wording left in Scripture, devotionals, reflections or prayers", () => {
    for (const s of SCRIPTURES) {
      expect(s.text, s.reference).not.toMatch(ARCHAIC);
      expect(s.reflection, s.reference).not.toMatch(ARCHAIC);
    }
    for (const d of DEVOTIONALS) {
      for (const field of [d.title, d.scripture, d.devotional, d.prayer, d.reflection]) expect(field, `Day ${d.day}`).not.toMatch(ARCHAIC);
    }
  });

  it("uses exact BSB phrases in reminder notifications", () => {
    for (const [ref, fragment] of Object.entries(BSB_FRAGMENTS)) {
      expect(BSB_PASSAGES[ref], ref).toContain(fragment);
      expect(scriptureFragment(ref, "unused")).toBe(`“${fragment}” (${ref}, BSB)`);
    }
    expect(FAITH_REMINDER_INFO.prayer.body).toBe(`“${BSB_PASSAGES["1 Thessalonians 5:17"]}” 1 Thessalonians 5:17 (BSB)`);
  });

  it("lets the AI coach quote only BSB verses from the app's list", () => {
    expect(COACH_VERSES.length).toBe(DEVOTIONALS.length);
    for (const v of COACH_VERSES) expect(v.text).toBe(BSB_PASSAGES[v.reference]);
    expect(FAITH_ENABLED_INSTRUCTIONS).toContain("(BSB)");
    expect(FAITH_ENABLED_INSTRUCTIONS).toContain("Berean Standard Bible");
    expect(FAITH_ENABLED_INSTRUCTIONS).not.toMatch(/\bKJV\b/);
  });
});
