// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseReference } from "@/lib/bible/reference";
import { getPassage } from "@/server/bible/text";
import { retrieveScripture } from "@/server/services/biblical-ai-retrieval";
import { EVAL_QUESTIONS } from "../biblical-ai-eval/questions";

/**
 * The Biblical AI evaluation set is itself checked: at least 250 questions across every required topic, unique ids,
 * and every expected reference is a real BSB passage (so the set can't reward a fabricated reference). Retrieval is
 * measured on it here, without any model: for a question that names a passage, that passage must be retrieved.
 */
const TOPICS = ["Gospel", "Salvation", "Repentance", "Saving faith", "Grace", "Faith and works", "Assurance", "Trinity", "Deity of Christ", "Biblical authority", "Sanctification", "Prayer", "Evangelism", "Apologetics", "Marriage", "Sexual ethics", "Suffering", "Spiritual gifts", "Baptism", "Predestination", "Free will", "Eternal security", "Eschatology", "Difficult passages", "Alleged contradictions", "Hebrew", "Aramaic", "Greek", "Historical context", "Archaeology", "Manuscripts", "Theological disagreements", "One voice"];

describe("Biblical AI evaluation set", () => {
  it("has at least 250 questions with unique ids, covering every required topic", () => {
    expect(EVAL_QUESTIONS.length).toBeGreaterThanOrEqual(250);
    expect(new Set(EVAL_QUESTIONS.map((q) => q.id)).size).toBe(EVAL_QUESTIONS.length);
    const topics = new Set(EVAL_QUESTIONS.map((q) => q.topic));
    for (const t of TOPICS) expect(topics.has(t), t).toBe(true);
    for (const q of EVAL_QUESTIONS) {
      expect(q.question.length, q.id).toBeGreaterThan(8);
      expect(q.refs.length, q.id).toBeGreaterThan(0);
      expect(q.expect.length, q.id).toBeGreaterThan(0);
    }
  });

  it("every expected reference is a real passage in the Berean Standard Bible", () => {
    const bad: string[] = [];
    for (const q of EVAL_QUESTIONS) {
      for (const ref of q.refs) {
        const r = parseReference(ref.replace(/^Psalms?\b/, "Psalm"));
        if (!r || getPassage(r).filter((v) => v.text).length === 0) bad.push(`${q.id}: ${ref}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("retrieval: when a question names a passage, that passage is given to the model", () => {
    const misses: string[] = [];
    let named = 0;
    for (const q of EVAL_QUESTIONS) {
      const inQuestion = q.refs.filter((ref) => q.question.includes(ref.split(":")[0]!) && /\d/.test(ref));
      if (!inQuestion.length) continue;
      named++;
      const got = retrieveScripture(q.question, { depth: q.depth, category: q.category });
      if (!got.passages.length) misses.push(q.id);
    }
    expect(named).toBeGreaterThan(20);
    expect(misses).toEqual([]);
  });
});
