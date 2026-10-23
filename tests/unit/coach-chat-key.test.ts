import { describe, expect, it } from "vitest";
import { chatCreated, initialChatKey, nextChatKey } from "@/lib/coach/chat-key";

describe("which chat the coach screen keeps mounted", () => {
  it("keeps a new chat on screen when it moves to its own URL after the first reply", () => {
    let s = initialChatKey(null);
    const before = s.key;
    s = chatCreated(s, "c1");
    s = nextChatKey(s, "c1");
    expect(s.key).toBe(before);
    // Re-renders with the same conversation change nothing.
    expect(nextChatKey(s, "c1")).toBe(s);
  });

  it("starts fresh for another chat, for New chat, and for a chat that wasn't the one just created", () => {
    let s = chatCreated(initialChatKey(null), "c1");
    s = nextChatKey(s, "c1");
    const kept = s.key;
    s = nextChatKey(s, "c2");
    expect(s.key).toBe("c2");
    s = nextChatKey(s, null);
    expect(s.key).not.toBe(kept);
    expect(s.key).toMatch(/^new-/);
    const fresh = s.key;
    expect(nextChatKey(s, "c9").key).toBe("c9");
    // Two "New chat" visits in a row get different keys, so the second one also starts empty.
    expect(nextChatKey(nextChatKey(s, "c3"), null).key).not.toBe(fresh);
  });

  it("opening an existing chat directly uses its id", () => {
    expect(initialChatKey("c5").key).toBe("c5");
  });
});
